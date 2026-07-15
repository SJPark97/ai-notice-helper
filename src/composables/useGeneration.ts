import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";

type Status = "idle" | "loading" | "success" | "error";

// 앱 전역 단일 생성 상태
const state = reactive({
  status: "idle" as Status,
  result: "",
  error: "",
});

// 직전 생성 입력 (다시 생성용)
let last = { message: "", prompt: "", language: "한국어" };

export function useGeneration() {
  // 공지 생성
  const generate = async (message: string, prompt: string, language: string): Promise<void> => {
    last = { message, prompt, language };
    state.status = "loading";
    state.error = "";
    try {
      state.result = await invoke<string>("generate_notice", { message, prompt, language });
      state.status = "success";
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  // 직전 입력으로 다시 생성
  const regenerate = (): Promise<void> => generate(last.message, last.prompt, last.language);

  // 현재 결과를 지시대로 AI 수정
  const refine = async (instruction: string): Promise<void> => {
    state.status = "loading";
    state.error = "";
    try {
      state.result = await invoke<string>("refine_notice", {
        current: state.result,
        instruction,
        language: last.language,
      });
      state.status = "success";
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  // 수동 편집 반영
  const setResult = (text: string): void => {
    state.result = text;
  };

  return { state, generate, regenerate, refine, setResult };
}
