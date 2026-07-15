import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useHistory } from "./useHistory";
import { useGlobalRules } from "./useGlobalRules";

type Status = "idle" | "loading" | "success" | "error";

// 결과 전체를 감싼 코드 펜스(```lang ... ```) 제거 (안전망)
const stripFence = (text: string): string => {
  const t = text.trim();
  const m = t.match(/^```[a-zA-Z]*\n?([\s\S]*?)\n?```$/);
  return m ? m[1].trim() : t;
};

// state.format은 결과 미리보기가 형식별 렌더에 사용
const state = reactive({ status: "idle" as Status, result: "", error: "", format: "plain" });

let last = { message: "", prompt: "", language: "한국어", format: "plain" };

export function useGeneration() {
  const { addRecord } = useHistory();
  const { state: rulesState } = useGlobalRules();

  // 스트리밍 공통 실행: 토큰 이벤트를 누적하고 done/error로 종료
  const runStream = async (
    command: string,
    args: Record<string, unknown>,
    language: string,
  ): Promise<void> => {
    state.status = "loading";
    state.result = "";
    state.error = "";
    const start = Date.now();
    const unlistens: Array<() => void> = [];
    const cleanup = (): void => {
      unlistens.forEach((u) => u());
      unlistens.length = 0;
    };
    try {
      unlistens.push(
        await listen<string>("notice://token", (e) => {
          state.result += e.payload;
        }),
      );
      unlistens.push(
        await listen("notice://done", () => {
          state.result = stripFence(state.result);
          state.status = "success";
          addRecord(state.result, language, Date.now() - start);
          cleanup();
        }),
      );
      unlistens.push(
        await listen<string>("notice://error", (e) => {
          state.status = "error";
          state.error = String(e.payload);
          cleanup();
        }),
      );
      await invoke(command, args);
    } catch (e) {
      state.status = "error";
      state.error = String(e);
      cleanup();
    }
  };

  // 공지 생성(스트리밍)
  const generate = async (
    message: string,
    prompt: string,
    language: string,
    format: string = "plain",
  ): Promise<void> => {
    last = { message, prompt, language, format };
    state.format = format;
    await runStream(
      "generate_notice_stream",
      { message, prompt, language, format, globalRules: rulesState.rules },
      language,
    );
  };

  // 직전 입력으로 다시 생성
  const regenerate = (): Promise<void> =>
    generate(last.message, last.prompt, last.language, last.format);

  // 현재 결과를 지시대로 AI 수정(스트리밍)
  const refine = async (instruction: string): Promise<void> => {
    const current = state.result; // 초기화 전에 캡처
    await runStream(
      "refine_notice_stream",
      {
        current,
        instruction,
        language: last.language,
        format: last.format,
        globalRules: rulesState.rules,
      },
      last.language,
    );
  };

  // 수동 편집 반영
  const setResult = (text: string): void => {
    state.result = text;
  };

  return { state, generate, regenerate, refine, setResult };
}
