import { describe, it, expect, beforeEach } from "vitest";
import { useGlobalRules } from "./useGlobalRules";

describe("useGlobalRules", () => {
  const g = useGlobalRules();
  beforeEach(() => {
    localStorage.clear();
    g.setRules("");
  });

  it("setRules로 규칙을 저장하고 localStorage에 남긴다", () => {
    g.setRules("항상 존댓말, 회사명은 인투씨엔에스");
    expect(g.state.rules).toBe("항상 존댓말, 회사명은 인투씨엔에스");
    expect(localStorage.getItem("ai-notice:globalRules")).toBe("항상 존댓말, 회사명은 인투씨엔에스");
  });
});
