import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useHistory } from "./useHistory";
import { useGlobalRules } from "./useGlobalRules";

type Status = "idle" | "loading" | "success" | "error";

// state.format은 결과 미리보기(Task 4)가 형식별 렌더를 위해 읽는다
const state = reactive({ status: "idle" as Status, result: "", error: "", format: "plain" });

let last = { message: "", prompt: "", language: "한국어", format: "plain" };

export function useGeneration() {
  const { addRecord } = useHistory();
  const { state: rulesState } = useGlobalRules();

  const generate = async (
    message: string,
    prompt: string,
    language: string,
    format: string = "plain",
  ): Promise<void> => {
    last = { message, prompt, language, format };
    state.format = format;
    state.status = "loading";
    state.error = "";
    const start = Date.now();
    try {
      state.result = await invoke<string>("generate_notice", {
        message,
        prompt,
        language,
        format,
        globalRules: rulesState.rules,
      });
      state.status = "success";
      addRecord(state.result, language, Date.now() - start);
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  const regenerate = (): Promise<void> =>
    generate(last.message, last.prompt, last.language, last.format);

  const refine = async (instruction: string): Promise<void> => {
    state.status = "loading";
    state.error = "";
    const start = Date.now();
    try {
      state.result = await invoke<string>("refine_notice", {
        current: state.result,
        instruction,
        language: last.language,
        format: last.format,
        globalRules: rulesState.rules,
      });
      state.status = "success";
      addRecord(state.result, last.language, Date.now() - start);
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  const setResult = (text: string): void => {
    state.result = text;
  };

  return { state, generate, regenerate, refine, setResult };
}
