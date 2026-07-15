# AI 공지 도우미 — Plan 10: 스트리밍 생성 (토큰 실시간 표시)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 공지가 생성되는 동안 결과가 **토큰 단위로 실시간** 나타나게 한다(진짜 진행감). Rust가 Ollama 스트리밍 응답을 읽어 Tauri 이벤트로 토큰을 emit하고, 프론트가 누적 표시한다. 형식/전역규칙(Plan 9)은 그대로 재사용.

**Architecture:** Rust `generate_notice_stream`/`refine_notice_stream`가 Ollama `/api/chat`(stream:true) NDJSON을 `resp.chunk()`로 읽어 줄 단위 파싱 후 `notice://token`(토큰)/`notice://done`/`notice://error` 이벤트를 AppHandle로 emit. 프론트 `useGeneration`이 이벤트를 listen해 `state.result`에 누적, done에 success. ResultView는 생성 중 누적 텍스트를 실시간 표시.

**Tech Stack:** Rust reqwest(chunk 스트리밍)+serde_json, Tauri Emitter/event, Vue 3, Vitest.

## Global Constraints

- Plan 1~9 위(main). ai.rs: `MODEL="gemma4:e4b"`, `Msg`, `SYSTEM_PROMPT`, `format_rule`/`rules_block`, `ChatReq`, 기존 `generate_notice`/`refine_notice`(비스트리밍, 유지). Ollama 스트리밍 형식: 각 줄 `{"message":{"content":"<토큰>"},"done":bool}` NDJSON.
- 이벤트 이름: `notice://token`(payload=String 토큰), `notice://done`(payload 없음), `notice://error`(payload=String).
- useGeneration(Plan 9): state{status,result,error,format}, generate(message,prompt,language,format)/regenerate/refine(instruction)/setResult, useHistory 기록, useGlobalRules로 전역규칙 읽음.
- 들여쓰기 스페이스, `<script setup lang="ts">`, data-test 훅. 커밋 `feat` + 한글 + **Co-Authored-By 절대 금지**. 한글 주석.
- 범위: 생성/AI수정을 스트리밍으로 전환 + 실시간 표시. 기존 비스트리밍 커맨드는 남겨둠(제거 안 함).

---

### Task 1: Rust 스트리밍 커맨드

**Files:**
- Modify: `src-tauri/src/ai.rs`
- Modify: `src-tauri/src/lib.rs` (invoke_handler 등록)
- Modify: `src-tauri/Cargo.toml` (serde_json)

**Interfaces:**
- Produces: `generate_notice_stream(app, message, prompt, language, format, global_rules) -> Result<(),String>`, `refine_notice_stream(app, current, instruction, language, format, global_rules) -> Result<(),String>`. 실행 중 `notice://token`/`notice://done`/`notice://error` emit.

- [ ] **Step 1: serde_json 추가**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo add serde_json
```

- [ ] **Step 2: ai.rs에 스트리밍 구현**

`src-tauri/src/ai.rs`에 추가(기존 유지). 파일 상단 `use`에 `use tauri::{AppHandle, Emitter};` 추가:
```rust
// Ollama 네이티브 채팅 스트리밍 엔드포인트
const NATIVE_CHAT_URL: &str = "http://localhost:11434/api/chat";

#[derive(Serialize)]
struct StreamReq<'a> {
    model: &'a str,
    messages: &'a [Msg],
    stream: bool,
}

#[derive(Deserialize)]
struct StreamMsg {
    content: String,
}

#[derive(Deserialize)]
struct StreamChunk {
    message: StreamMsg,
    done: bool,
}

// Ollama 스트리밍 응답을 줄 단위로 읽어 토큰을 이벤트로 emit
async fn stream_ai(app: &AppHandle, messages: Vec<Msg>) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = StreamReq { model: MODEL, messages: &messages, stream: true };
    let mut resp = client
        .post(NATIVE_CHAT_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI 서버 연결 실패 (Ollama 실행 중인지 확인): {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AI 서버 오류: {}", resp.status()));
    }
    let mut buf = String::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        buf.push_str(&String::from_utf8_lossy(&chunk));
        // 완성된 줄(개행)마다 파싱
        while let Some(nl) = buf.find('\n') {
            let line: String = buf.drain(..=nl).collect();
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(c) = serde_json::from_str::<StreamChunk>(line) {
                if !c.message.content.is_empty() {
                    let _ = app.emit("notice://token", c.message.content);
                }
                if c.done {
                    let _ = app.emit("notice://done", ());
                }
            }
        }
    }
    Ok(())
}

// 공지 생성(스트리밍)
#[tauri::command]
pub async fn generate_notice_stream(
    app: AppHandle,
    message: String,
    prompt: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<(), String> {
    let user = format!(
        "{rules}원본 메시지:\n{message}\n\n지시:\n{prompt}\n\n{fmt}\n출력 언어: {language}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    let r = stream_ai(&app, messages).await;
    if let Err(e) = &r {
        let _ = app.emit("notice://error", e.clone());
    }
    r
}

// AI 수정(스트리밍)
#[tauri::command]
pub async fn refine_notice_stream(
    app: AppHandle,
    current: String,
    instruction: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<(), String> {
    let user = format!(
        "{rules}아래 공지를 다음 지시에 맞게 다시 작성해줘. 언어는 {language}로 유지.\n{fmt}\n\n[현재 공지]\n{current}\n\n[지시]\n{instruction}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    let r = stream_ai(&app, messages).await;
    if let Err(e) = &r {
        let _ = app.emit("notice://error", e.clone());
    }
    r
}
```
> `resp.chunk()`는 reqwest 기본 기능. 만약 빌드가 chunk/stream 관련으로 실패하면 `reqwest` features에 `"stream"` 추가하고 노트.
> `Msg`가 `Serialize`+`Deserialize` 모두 파생돼 있어 `StreamReq`의 `&[Msg]` 직렬화 가능(기존 그대로).

- [ ] **Step 3: lib.rs invoke_handler 등록**

`src-tauri/src/lib.rs`의 `invoke_handler`에 두 커맨드 추가(기존 유지):
```rust
        .invoke_handler(tauri::generate_handler![
            greet,
            ai::generate_notice,
            ai::refine_notice,
            ai::generate_notice_stream,
            ai::refine_notice_stream
        ])
```

- [ ] **Step 4: 빌드 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo build
```
Expected: 컴파일 성공. `AppHandle`/`Emitter` import, `serde_json`, `resp.chunk()` 모두 해결.

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/
git commit -m "feat: 스트리밍 생성 Rust 커맨드 추가

- generate_notice_stream/refine_notice_stream: Ollama 스트리밍을 읽어 토큰 이벤트 emit
- notice://token/done/error 이벤트, serde_json 추가, lib.rs 등록"
```

---

### Task 2: useGeneration 스트리밍 전환

**Files:**
- Modify: `src/composables/useGeneration.ts`
- Modify: `src/composables/useGeneration.test.ts`

**Interfaces:**
- Consumes: Task 1 스트리밍 커맨드 + `notice://*` 이벤트.
- Produces: `generate`/`regenerate`/`refine`가 스트리밍 커맨드를 호출하고 이벤트로 `state.result`를 누적, done에 success+기록, error에 error. 시그니처 불변.

- [ ] **Step 1: 테스트 재작성(실패 확인)**

`src/composables/useGeneration.test.ts`를 스트리밍 방식으로 재작성. `@tauri-apps/api/event`의 `listen`을 모킹해 콜백을 잡고, invoke 모킹에서 토큰/done을 발화:
```ts
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
});
```
> refine 테스트: refine는 시작 시 `state.result`를 ""로 초기화하고 스트리밍하므로, invoke에 넘기는 `current`는 초기화 이전 값이어야 한다 → 구현에서 current를 초기화 전에 캡처(아래 Step 2 참고).

- [ ] **Step 2: useGeneration 구현**

`src/composables/useGeneration.ts`를 아래로 교체:
```ts
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useHistory } from "./useHistory";
import { useGlobalRules } from "./useGlobalRules";

type Status = "idle" | "loading" | "success" | "error";

// state.format은 결과 미리보기가 형식별 렌더에 사용
const state = reactive({ status: "idle" as Status, result: "", error: "", format: "plain" });

let last = { message: "", prompt: "", language: "한국어", format: "plain" };

export function useGeneration() {
  const { addRecord } = useHistory();
  const { state: rulesState } = useGlobalRules();

  // 스트리밍 공통 실행: 토큰 이벤트를 누적하고 done/error로 종료
  const runStream = async (
    command: string,
    args: Record<string, unknown>,
    language: string,
  ): Promise<void> => {
    state.status = "loading";
    state.result = "";
    state.error = "";
    const start = Date.now();
    const unlistens: Array<() => void> = [];
    const cleanup = (): void => {
      unlistens.forEach((u) => u());
      unlistens.length = 0;
    };
    try {
      unlistens.push(
        await listen<string>("notice://token", (e) => {
          state.result += e.payload;
        }),
      );
      unlistens.push(
        await listen("notice://done", () => {
          state.status = "success";
          addRecord(state.result, language, Date.now() - start);
          cleanup();
        }),
      );
      unlistens.push(
        await listen<string>("notice://error", (e) => {
          state.status = "error";
          state.error = String(e.payload);
          cleanup();
        }),
      );
      await invoke(command, args);
    } catch (e) {
      state.status = "error";
      state.error = String(e);
      cleanup();
    }
  };

  // 공지 생성(스트리밍)
  const generate = async (
    message: string,
    prompt: string,
    language: string,
    format: string = "plain",
  ): Promise<void> => {
    last = { message, prompt, language, format };
    state.format = format;
    await runStream(
      "generate_notice_stream",
      { message, prompt, language, format, globalRules: rulesState.rules },
      language,
    );
  };

  // 직전 입력으로 다시 생성
  const regenerate = (): Promise<void> =>
    generate(last.message, last.prompt, last.language, last.format);

  // 현재 결과를 지시대로 AI 수정(스트리밍)
  const refine = async (instruction: string): Promise<void> => {
    const current = state.result; // 초기화 전에 캡처
    await runStream(
      "refine_notice_stream",
      {
        current,
        instruction,
        language: last.language,
        format: last.format,
        globalRules: rulesState.rules,
      },
      last.language,
    );
  };

  // 수동 편집 반영
  const setResult = (text: string): void => {
    state.result = text;
  };

  return { state, generate, regenerate, refine, setResult };
}
```

- [ ] **Step 3: 통과 확인 + 빌드**

Run: `cd /Users/sjpark/Documents/project/ai && npm test && npm run build`
Expected: 전부 PASS(스트리밍 테스트 4건 포함), 빌드 green.

- [ ] **Step 4: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/useGeneration.ts src/composables/useGeneration.test.ts
git commit -m "feat: 생성/AI수정을 스트리밍으로 전환

- useGeneration: notice://token 이벤트로 결과 실시간 누적, done에 success·기록
- generate_notice_stream/refine_notice_stream 호출, 에러 이벤트 처리"
```

---

### Task 3: ResultView 실시간 스트리밍 표시

**Files:**
- Modify: `src/views/ResultView.vue`

**Interfaces:**
- Consumes: useGeneration `state.status`/`state.result`. 생성 중 누적 텍스트를 실시간 표시.

- [ ] **Step 1: 로딩 블록에 스트리밍 텍스트 표시**

`src/views/ResultView.vue`의 loading 블록(`v-if="state.status === 'loading'"`)을 아래로 교체 — 토큰이 오기 시작하면 누적 텍스트를 실시간 표시, 아직 없으면 진행바(스피너는 유지):
```vue
    <!-- 로딩/스트리밍 -->
    <div v-if="state.status === 'loading'" class="loading" data-test="status-loading">
      <div class="loading-head">
        <span class="spinner" aria-hidden="true"></span>
        <span>AI가 공지를 생성 중입니다…</span>
      </div>
      <pre v-if="state.result" class="rendered-plain streaming" data-test="streaming">{{ state.result }}</pre>
      <div v-else class="progress-bar" role="progressbar" aria-label="생성 진행 중"></div>
    </div>
```
(error/success 블록, 편집/미리보기 토글, refine-row, actions는 그대로 유지.)

- [ ] **Step 2: 스트리밍 텍스트 스타일 추가**

`<style scoped>`에 추가(기존 유지):
```css
.streaming {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 120px;
  max-height: 420px;
  overflow: auto;
}
</style>
```

- [ ] **Step 3: 테스트 + 빌드**

Run: `cd /Users/sjpark/Documents/project/ai && npm test && npm run build`
Expected: 전부 PASS(`status-loading` 훅 유지되어 기존 테스트 영향 없음), 빌드 green.

- [ ] **Step 4: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/views/ResultView.vue
git commit -m "feat: 생성 중 스트리밍 텍스트 실시간 표시

- ResultView 로딩 상태에서 누적 결과를 실시간 표시(pre), 토큰 전엔 진행바"
```

---

## 완료 기준 (Plan 10)

- 공지 생성/AI 수정 시 결과가 **토큰 단위로 실시간** 나타난다(빈 화면→진행바→글자가 차오름).
- 완료되면 편집/미리보기 토글이 있는 결과 화면이 된다.
- 생성 실패 시 에러 표시.
- `npm test` 통과, `npm run build` 그린, `cargo build` 성공.

## 다음 (선택, 범위 아님)

- Ollama 없이 배포(llama-server 사이드카 번들).
