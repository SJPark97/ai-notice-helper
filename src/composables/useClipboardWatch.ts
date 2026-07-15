import { onMounted, onUnmounted } from "vue";
import { startListening, onTextUpdate } from "tauri-plugin-clipboard-api";
import { useClipboardMessages } from "./useClipboardMessages";

// 클립보드 변경을 구독해 감시 중일 때만 메시지를 적재한다.
// App 루트에서 1회 호출한다.
export function useClipboardWatch() {
  const { state, addMessage } = useClipboardMessages();

  let stopMonitor: (() => Promise<void>) | null = null;
  let unlistenText: (() => void) | null = null;

  onMounted(async () => {
    // 텍스트 변경 이벤트 구독: 감시 on일 때만 적재
    unlistenText = await onTextUpdate((text: string) => {
      if (state.watching) addMessage(text);
    });
    // 모니터 스레드 시작
    stopMonitor = await startListening();
  });

  onUnmounted(async () => {
    if (unlistenText) unlistenText();
    if (stopMonitor) await stopMonitor();
  });
}
