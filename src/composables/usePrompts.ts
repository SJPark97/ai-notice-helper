import { reactive } from "vue";

// AI 지시 프롬프트(제목 + 내용)
export interface Prompt {
  id: string;
  title: string;
  content: string;
}

const STORAGE_KEY = "ai-notice:prompts";

// localStorage에서 초기 로드 (손상 시 빈 배열)
const load = (): Prompt[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Prompt[]) : [];
  } catch {
    return [];
  }
};

// 앱 전역 단일 상태
const state = reactive({ prompts: load() as Prompt[] });

// 현재 상태를 localStorage에 저장
const persist = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prompts));
};

let seq = 0;
const genId = (): string => `p${Date.now()}_${++seq}`;

export function usePrompts() {
  // 새 프롬프트 저장 (빈 제목은 무시)
  const savePrompt = (title: string, content: string): Prompt | null => {
    const t = title.trim();
    if (!t) return null;
    const p: Prompt = { id: genId(), title: t, content };
    state.prompts.push(p);
    persist();
    return p;
  };

  // 기존 프롬프트 수정 (없는 id·빈 제목은 무시)
  const updatePrompt = (id: string, title: string, content: string): void => {
    const p = state.prompts.find((x) => x.id === id);
    if (!p) return;
    const t = title.trim();
    if (!t) return;
    p.title = t;
    p.content = content;
    persist();
  };

  // 삭제
  const deletePrompt = (id: string): void => {
    const i = state.prompts.findIndex((x) => x.id === id);
    if (i >= 0) {
      state.prompts.splice(i, 1);
      persist();
    }
  };

  // id로 조회
  const getPrompt = (id: string): Prompt | undefined =>
    state.prompts.find((x) => x.id === id);

  return { state, savePrompt, updatePrompt, deletePrompt, getPrompt };
}
