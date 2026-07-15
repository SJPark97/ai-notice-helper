import { describe, it, expect, beforeEach } from "vitest";
import { useClipboardMessages } from "./useClipboardMessages";

describe("useClipboardMessages", () => {
  const cb = useClipboardMessages();
  beforeEach(() => cb.clear());

  it("빈 문자열/공백은 무시한다", () => {
    cb.addMessage("   ");
    expect(cb.state.messages).toHaveLength(0);
  });

  it("새 메시지를 최신순으로 앞에 추가한다", () => {
    cb.addMessage("첫번째");
    cb.addMessage("두번째");
    expect(cb.state.messages[0].text).toBe("두번째");
    expect(cb.state.messages[1].text).toBe("첫번째");
  });

  it("직전과 동일한 텍스트는 중복 추가하지 않는다", () => {
    cb.addMessage("같은내용");
    cb.addMessage("같은내용");
    expect(cb.state.messages).toHaveLength(1);
  });

  it("최대 20개까지만 보관한다", () => {
    for (let i = 0; i < 25; i++) cb.addMessage(`메시지 ${i}`);
    expect(cb.state.messages).toHaveLength(20);
    expect(cb.state.messages[0].text).toBe("메시지 24");
  });

  it("preview는 80자로 자르고 말줄임표를 붙인다", () => {
    cb.addMessage("가".repeat(100));
    expect(cb.state.messages[0].preview.endsWith("…")).toBe(true);
    expect(cb.state.messages[0].preview.length).toBe(81);
  });

  it("select로 선택하면 selectedMessage가 해당 항목이 된다", () => {
    cb.addMessage("골라줘");
    cb.select(cb.state.messages[0].id);
    expect(cb.selectedMessage.value?.text).toBe("골라줘");
  });

  it("clear는 목록과 선택을 비운다", () => {
    cb.addMessage("지울거");
    cb.select(cb.state.messages[0].id);
    cb.clear();
    expect(cb.state.messages).toHaveLength(0);
    expect(cb.selectedMessage.value).toBeNull();
  });

  it("setWatching으로 감시 상태를 바꾼다", () => {
    cb.setWatching(false);
    expect(cb.state.watching).toBe(false);
    cb.setWatching(true);
    expect(cb.state.watching).toBe(true);
  });
});
