import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type Phase = "starting" | "downloading" | "ready" | "error";

const state = reactive({
    phase: "starting" as Phase,
    percent: 0,
    statusText: "AI 런타임을 준비하는 중...",
    error: "",
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ollama serve가 응답할 때까지 대기(최대 60초)
const waitReady = async (): Promise<boolean> => {
    for (let i = 0; i < 60; i += 1) {
        if (await invoke<boolean>("ollama_ready")) {
            return true;
        }
        await sleep(1000);
    }
    return false;
};

// 모델 스트리밍 다운로드 + 진행률 반영
const runPull = async (): Promise<void> => {
    state.phase = "downloading";
    state.percent = 0;
    state.statusText = "AI 모델 다운로드 중...";

    const unProgress = await listen<{ status: string; completed: number; total: number }>(
        "model://progress",
        (e) => {
            const { status, completed, total } = e.payload;
            if (total > 0) {
                state.percent = Math.floor((completed / total) * 100);
            }
            if (status) {
                state.statusText = total > 0 ? `${status} (${state.percent}%)` : status;
            }
        },
    );
    const unDone = await listen("model://done", () => {
        state.percent = 100;
    });
    const unError = await listen<string>("model://error", (e) => {
        state.phase = "error";
        state.error = e.payload;
    });

    try {
        await invoke("pull_model");
    } catch (err) {
        state.phase = "error";
        state.error = String(err);
    } finally {
        unProgress();
        unDone();
        unError();
    }
};

// 부트스트랩: 런타임 대기 → 모델 확인 → 없으면 다운로드 → ready
export const startBootstrap = async (): Promise<void> => {
    state.phase = "starting";
    state.error = "";
    state.statusText = "AI 런타임을 준비하는 중...";

    if (!(await waitReady())) {
        state.phase = "error";
        state.error = "AI 런타임을 시작하지 못했습니다.";
        return;
    }
    const installed = await invoke<boolean>("model_installed");
    if (!installed) {
        await runPull();
    }
    if ((state.phase as Phase) !== "error") {
        state.phase = "ready";
    }
};

export const useBootstrap = () => ({ state, startBootstrap });
