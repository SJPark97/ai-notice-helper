import { describe, it, expect, beforeEach } from "vitest";
import { useTemplates } from "./useTemplates";

describe("useTemplates", () => {
  const tpl = useTemplates();

  beforeEach(() => {
    // 상태·저장소 초기화
    tpl.state.templates.splice(0);
    localStorage.clear();
  });

  it("템플릿을 저장하면 목록에 추가되고 localStorage에 남는다", () => {
    tpl.saveTemplate("배포 기본", { type: "배포", language: "한국어", requirement: "존댓말, 3줄" });
    expect(tpl.state.templates).toHaveLength(1);
    expect(tpl.state.templates[0].name).toBe("배포 기본");
    const raw = localStorage.getItem("ai-notice:templates");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });

  it("빈 이름은 저장하지 않고 null을 반환한다", () => {
    const r = tpl.saveTemplate("   ", { type: "일반", language: "한국어", requirement: "" });
    expect(r).toBeNull();
    expect(tpl.state.templates).toHaveLength(0);
  });

  it("저장한 템플릿을 id로 조회한다", () => {
    const saved = tpl.saveTemplate("장애", { type: "장애", language: "English", requirement: "short" });
    expect(saved).not.toBeNull();
    expect(tpl.getTemplate((saved as { id: string }).id)?.type).toBe("장애");
  });

  it("템플릿을 삭제하면 목록과 저장소에서 사라진다", () => {
    const saved = tpl.saveTemplate("삭제대상", { type: "일반", language: "한국어", requirement: "" });
    tpl.deleteTemplate((saved as { id: string }).id);
    expect(tpl.state.templates).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("ai-notice:templates") as string)).toHaveLength(0);
  });
});
