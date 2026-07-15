import { reactive } from "vue";

const STORAGE_KEY = "ai-notice:globalRules";

// 앱 전역 단일 상태 (모든 생성에 적용되는 규칙)
const state = reactive({ rules: localStorage.getItem(STORAGE_KEY) ?? "" });

export function useGlobalRules() {
  // 규칙 저장(상태 + localStorage)
  const setRules = (text: string): void => {
    state.rules = text;
    localStorage.setItem(STORAGE_KEY, text);
  };

  return { state, setRules };
}
