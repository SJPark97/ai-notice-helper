import { reactive, computed, type ComputedRef } from "vue";

// 복사한 메시지 한 건
export interface ClipboardMessage {
  id: number;
  text: string;
  preview: string;
  capturedAt: Date;
}

// 최근 보관 최대 개수
const MAX_MESSAGES = 20;

// 앱 전역 단일 상태
const state = reactive({
  messages: [] as ClipboardMessage[],
  selectedId: null as number | null,
  watching: true,
});

let nextId = 0;

// 미리보기: 여러 줄/공백을 한 줄로 정리 후 80자 제한
const toPreview = (text: string): string => {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
};

export function useClipboardMessages() {
  // 새 클립보드 텍스트 추가 (빈 값·직전과 동일은 무시, 최신순, 최대 20개)
  const addMessage = (rawText: string): void => {
    const text = rawText.trim();
    if (!text) return;
    if (state.messages.length > 0 && state.messages[0].text === text) return;
    state.messages.unshift({
      id: ++nextId,
      text,
      preview: toPreview(text),
      capturedAt: new Date(),
    });
    if (state.messages.length > MAX_MESSAGES) {
      state.messages.splice(MAX_MESSAGES);
    }
  };

  // 메시지 선택
  const select = (id: number): void => {
    state.selectedId = id;
  };

  // 목록·선택 비우기
  const clear = (): void => {
    state.messages.splice(0);
    state.selectedId = null;
  };

  // 감시 on/off
  const setWatching = (on: boolean): void => {
    state.watching = on;
  };

  // 현재 선택된 메시지 (후속 생성 Plan에서 사용)
  const selectedMessage: ComputedRef<ClipboardMessage | null> = computed(
    () => state.messages.find((m) => m.id === state.selectedId) ?? null,
  );

  return { state, addMessage, select, clear, setWatching, selectedMessage };
}
