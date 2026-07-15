import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
const listeners: Record<string, (e: any) => void> = {};
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: any[]) => invokeMock(...a) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, cb: (e: any) => void) => {
    listeners[name] = cb;
    return Promise.resolve(() => {});
  },
}));

import { useBootstrap } from "./useBootstrap";

describe("useBootstrap", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    for (const k of Object.keys(listeners)) delete listeners[k];
  });

  it("모델이 이미 있으면 바로 ready", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "ollama_ready") return true;
      if (cmd === "model_installed") return true;
      return undefined;
    });
    const { state, startBootstrap } = useBootstrap();
    await startBootstrap();
    expect(state.phase).toBe("ready");
  });

  it("모델이 없으면 다운로드 후 ready, 진행률 계산", async () => {
    let pulled = false;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "ollama_ready") return true;
      if (cmd === "model_installed") return pulled; // pull 완료 후에는 설치됨
      if (cmd === "pull_model") {
        listeners["model://progress"]({ payload: { status: "pulling", completed: 5, total: 10 } });
        listeners["model://done"]({ payload: undefined });
        pulled = true;
        return undefined;
      }
      return undefined;
    });
    const { state, startBootstrap } = useBootstrap();
    await startBootstrap();
    expect(state.percent).toBe(100);
    expect(state.phase).toBe("ready");
  });

  it("다운로드가 끝났는데 모델이 여전히 없으면 error", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "ollama_ready") return true;
      if (cmd === "model_installed") return false; // pull 후에도 미설치
      if (cmd === "pull_model") return undefined; // success 이벤트 없이 조기 종료
      return undefined;
    });
    const { state, startBootstrap } = useBootstrap();
    await startBootstrap();
    expect(state.phase).toBe("error");
  });
});
