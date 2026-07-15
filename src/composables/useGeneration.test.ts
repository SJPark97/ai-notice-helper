import { describe, it, expect, beforeEach, vi } from "vitest";

const invokeMock = vi.fn();
const listeners: Record<string, (e: { payload: unknown }) => void> = {};
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, cb: (e: { payload: unknown }) => void) => {
    listeners[event] = cb;
    return Promise.resolve(() => { delete listeners[event]; });
  },
}));

import { useGeneration } from "./useGeneration";
import { useGlobalRules } from "./useGlobalRules";

describe("useGeneration 스트리밍", () => {
  const g = useGeneration();
  beforeEach(() => {
    invokeMock.mockReset();
    g.setResult("");
    g.state.status = "idle";
    g.state.error = "";
    useGlobalRules().setRules("");
  });

  it("generate: 토큰을 누적하고 done에 success", async () => {
    invokeMock.mockImplementation(async () => {
      listeners["notice://token"]({ payload: "배포 " });
      listeners["notice://token"]({ payload: "공지" });
      listeners["notice://done"]({ payload: undefined });
    });
    await g.generate("메시지", "지시", "한국어", "plain");
    expect(g.state.result).toBe("배포 공지");
    expect(g.state.status).toBe("success");
    expect(invokeMock).toHaveBeenCalledWith("generate_notice_stream", {
      message: "메시지",
      prompt: "지시",
      language: "한국어",
      format: "plain",
      globalRules: "",
    });
  });

  it("generate: error 이벤트 시 error 상태", async () => {
    invokeMock.mockImplementation(async () => {
      listeners["notice://error"]({ payload: "AI 서버 연결 실패" });
    });
    await g.generate("m", "p", "한국어", "plain");
    expect(g.state.status).toBe("error");
    expect(g.state.error).toContain("연결 실패");
  });

  it("regenerate: 직전 입력으로 스트리밍 재호출", async () => {
    invokeMock.mockImplementation(async () => {
      listeners["notice://token"]({ payload: "결과" });
      listeners["notice://done"]({ payload: undefined });
    });
    await g.generate("원본", "지시문", "한국어", "markdown");
    await g.regenerate();
    expect(invokeMock).toHaveBeenLastCalledWith("generate_notice_stream", {
      message: "원본",
      prompt: "지시문",
      language: "한국어",
      format: "markdown",
      globalRules: "",
    });
  });

  it("refine: 현재 결과와 지시로 refine_notice_stream 스트리밍", async () => {
    invokeMock.mockImplementation(async () => {
      listeners["notice://token"]({ payload: "수정본" });
      listeners["notice://done"]({ payload: undefined });
    });
    await g.generate("m", "p", "한국어", "plain");
    g.setResult("초안");
    await g.refine("더 짧게");
    expect(invokeMock).toHaveBeenLastCalledWith("refine_notice_stream", {
      current: "초안",
      instruction: "더 짧게",
      language: "한국어",
      format: "plain",
      globalRules: "",
    });
    expect(g.state.result).toBe("수정본");
  });

  it("코드 펜스로 감싼 결과는 펜스를 제거한다", async () => {
    invokeMock.mockImplementation(async () => {
      listeners["notice://token"]({ payload: "```html\n<b>공지</b>\n```" });
      listeners["notice://done"]({ payload: undefined });
    });
    await g.generate("m", "p", "한국어", "html");
    expect(g.state.result).toBe("<b>공지</b>");
    expect(g.state.status).toBe("success");
  });
});
