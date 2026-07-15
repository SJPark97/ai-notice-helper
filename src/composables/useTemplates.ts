import { reactive } from "vue";

// 공지 템플릿(이름 붙인 프리셋)
export interface NoticeTemplate {
  id: string;
  name: string;
  type: string;
  language: string;
  requirement: string;
}

const STORAGE_KEY = "ai-notice:templates";

// localStorage에서 초기 로드 (손상 시 빈 배열)
const load = (): NoticeTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NoticeTemplate[]) : [];
  } catch {
    return [];
  }
};

// 앱 전역 단일 상태
const state = reactive({ templates: load() as NoticeTemplate[] });

// 현재 상태를 localStorage에 저장
const persist = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.templates));
};

let seq = 0;
// 간단한 고유 id (런타임 전용)
const genId = (): string => `t${Date.now()}_${++seq}`;

export function useTemplates() {
  // 현재 프리셋을 이름 붙여 저장 (빈 이름은 무시)
  const saveTemplate = (
    name: string,
    preset: { type: string; language: string; requirement: string },
  ): NoticeTemplate | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const tpl: NoticeTemplate = {
      id: genId(),
      name: trimmed,
      type: preset.type,
      language: preset.language,
      requirement: preset.requirement,
    };
    state.templates.push(tpl);
    persist();
    return tpl;
  };

  // 템플릿 삭제
  const deleteTemplate = (id: string): void => {
    const i = state.templates.findIndex((t) => t.id === id);
    if (i >= 0) {
      state.templates.splice(i, 1);
      persist();
    }
  };

  // id로 조회
  const getTemplate = (id: string): NoticeTemplate | undefined =>
    state.templates.find((t) => t.id === id);

  return { state, saveTemplate, deleteTemplate, getTemplate };
}
