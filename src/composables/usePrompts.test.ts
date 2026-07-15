import { describe, it, expect, beforeEach } from "vitest";
import { usePrompts } from "./usePrompts";

describe("usePrompts", () => {
  const p = usePrompts();
  beforeEach(() => {
    p.state.prompts.splice(0);
    localStorage.clear();
  });

  it("제목+내용을 저장하면 목록·저장소에 추가된다", () => {
    p.savePrompt("배포 공지", "배포 메시지를 존댓말 3줄로 요약해줘");
    expect(p.state.prompts).toHaveLength(1);
    expect(p.state.prompts[0].title).toBe("배포 공지");
    expect(p.state.prompts[0].content).toBe("배포 메시지를 존댓말 3줄로 요약해줘");
    expect(JSON.parse(localStorage.getItem("ai-notice:prompts") as string)).toHaveLength(1);
  });

  it("빈 제목은 저장하지 않고 null을 반환한다", () => {
    expect(p.savePrompt("   ", "내용")).toBeNull();
    expect(p.state.prompts).toHaveLength(0);
  });

  it("updatePrompt로 제목/내용을 수정한다", () => {
    const saved = p.savePrompt("원본", "원본내용");
    p.updatePrompt((saved as { id: string }).id, "수정됨", "새 내용");
    const got = p.getPrompt((saved as { id: string }).id);
    expect(got?.title).toBe("수정됨");
    expect(got?.content).toBe("새 내용");
    expect(JSON.parse(localStorage.getItem("ai-notice:prompts") as string)[0].title).toBe("수정됨");
  });

  it("빈 제목으로 수정하면 무시한다", () => {
    const saved = p.savePrompt("원본", "원본내용");
    p.updatePrompt((saved as { id: string }).id, "  ", "x");
    expect(p.getPrompt((saved as { id: string }).id)?.title).toBe("원본");
  });

  it("deletePrompt로 삭제한다", () => {
    const saved = p.savePrompt("삭제대상", "x");
    p.deletePrompt((saved as { id: string }).id);
    expect(p.state.prompts).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("ai-notice:prompts") as string)).toHaveLength(0);
  });
});
