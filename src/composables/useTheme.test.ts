import { describe, it, expect, beforeEach } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  const t = useTheme();
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("setTheme은 상태·저장소·data-theme를 갱신한다", () => {
    t.setTheme("dark");
    expect(t.theme.value).toBe("dark");
    expect(localStorage.getItem("ai-notice:theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggleTheme은 라이트↔다크를 전환한다", () => {
    t.setTheme("light");
    t.toggleTheme();
    expect(t.theme.value).toBe("dark");
    t.toggleTheme();
    expect(t.theme.value).toBe("light");
  });

  it("initTheme은 저장값을 적용한다", () => {
    localStorage.setItem("ai-notice:theme", "dark");
    t.initTheme();
    expect(t.theme.value).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
