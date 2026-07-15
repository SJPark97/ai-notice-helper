import { reactive } from "vue";

// 최근 생성 기록 (원본 메시지는 저장하지 않음)
export interface HistoryRecord {
  id: string;
  notice: string;
  language: string;
  responseMs: number;
  createdAt: string;
}

const STORAGE_KEY = "ai-notice:history";
const MAX_RECORDS = 20;

// localStorage에서 초기 로드 (손상 시 빈 배열)
const load = (): HistoryRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryRecord[]) : [];
  } catch {
    return [];
  }
};

// 앱 전역 단일 상태
const state = reactive({ records: load() as HistoryRecord[] });

// 현재 상태를 localStorage에 저장
const persist = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
};

let seq = 0;
const genId = (): string => `h${Date.now()}_${++seq}`;

export function useHistory() {
  // 생성 성공 공지를 기록 (빈 값 무시, 최신순, 최대 20)
  const addRecord = (notice: string, language: string, responseMs: number): void => {
    if (!notice.trim()) return;
    state.records.unshift({
      id: genId(),
      notice,
      language,
      responseMs,
      createdAt: new Date().toISOString(),
    });
    if (state.records.length > MAX_RECORDS) {
      state.records.splice(MAX_RECORDS);
    }
    persist();
  };

  // 전체 기록 삭제
  const clearHistory = (): void => {
    state.records.splice(0);
    persist();
  };

  // id로 조회
  const getRecord = (id: string): HistoryRecord | undefined =>
    state.records.find((r) => r.id === id);

  return { state, addRecord, clearHistory, getRecord };
}
