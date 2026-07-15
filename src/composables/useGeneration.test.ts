import { describe, it, expect, beforeEach, vi } from "vitest";

// @tauri-apps/api/core invoke 모킹
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { useGeneration } from "./useGeneration";
import { useHistory } from "./useHistory";

describe("useGeneration", () => {
  const g = useGeneration();
  beforeEach(() => {
    invokeMock.mockReset();
    g.setResult("");
    g.state.status = "idle";
    g.state.error = "";
  });

  it("generate 성공 시 결과와 success 상태", async () => {
    invokeMock.mockResolvedValue("📢 배포 공지\n- 내용");
    await g.generate("메시지", "3줄로", "한국어");
    expect(g.state.status).toBe("success");
    expect(g.state.result).toContain("배포 공지");
    expect(invokeMock).toHaveBeenCalledWith("generate_notice", {
      message: "메시지",
      prompt: "3줄로",
      language: "한국어",
    });
  });

  it("generate 실패 시 error 상태와 메시지", async () => {
    invokeMock.mockRejectedValue("AI 서버 연결 실패");
    await g.generate("메시지", "지시", "한국어");
    expect(g.state.status).toBe("error");
    expect(g.state.error).toContain("연결 실패");
  });

  it("regenerate는 직전 입력으로 다시 호출한다", async () => {
    invokeMock.mockResolvedValue("결과1");
    await g.generate("원본메시지", "지시문", "한국어");
    invokeMock.mockResolvedValue("결과2");
    await g.regenerate();
    expect(invokeMock).toHaveBeenLastCalledWith("generate_notice", {
      message: "원본메시지",
      prompt: "지시문",
      language: "한국어",
    });
    expect(g.state.result).toBe("결과2");
  });

  it("refine은 현재 결과와 지시로 refine_notice를 호출한다", async () => {
    invokeMock.mockResolvedValue("초안");
    await g.generate("m", "p", "한국어");
    invokeMock.mockResolvedValue("더 짧은 버전");
    await g.refine("더 짧게");
    expect(invokeMock).toHaveBeenLastCalledWith("refine_notice", {
      current: "초안",
      instruction: "더 짧게",
      language: "한국어",
    });
    expect(g.state.result).toBe("더 짧은 버전");
  });

  it("generate 성공 시 최근 기록에 추가된다", async () => {
    const h = useHistory();
    h.clearHistory();
    invokeMock.mockResolvedValue("생성된 공지 본문");
    await g.generate("메시지", "지시", "한국어");
    expect(h.state.records[0].notice).toBe("생성된 공지 본문");
    expect(h.state.records[0].language).toBe("한국어");
  });
});
