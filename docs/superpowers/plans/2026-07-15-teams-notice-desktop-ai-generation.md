# AI 공지 도우미 — Plan 5: AI 공지 생성 (실제 Gemma 4 via Ollama)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** "공지 생성"을 누르면 선택한 클립보드 메시지 + 프롬프트 내용 + 언어를 실제 로컬 AI(Gemma 4 E4B, Ollama OpenAI 호환 API)로 보내 공지문을 생성하고, 결과 화면에서 확인·수정·복사·다시생성·AI수정한다. 메시지 미선택 등 조건은 피드백을 준다.

**Architecture:** Rust에 OpenAI 호환 HTTP를 호출하는 `generate_notice`/`refine_notice` 커맨드(reqwest → `http://localhost:11434/v1/chat/completions`, 모델 `gemma4:e4b`). 프론트는 `useGeneration` 컴포저블(invoke 래핑 + 상태)로 생성/재생성/AI수정을 관리하고, MainView는 입력 검증 후 생성을 트리거, ResultView는 로딩/결과/에러와 액션을 렌더. 엔드포인트/모델은 상수로 두어 추후 llama-server 사이드카로 교체 가능.

**Tech Stack:** Rust reqwest(async), Tauri command, Vue 3 `<script setup lang="ts">`, `@tauri-apps/api/core` invoke, Vitest(jsdom, invoke mock).

## Global Constraints

- Plan 1~4 위(main). 프롬프트=`{title,content}`(usePrompts), 공지유형 없음(AI가 판단). 클립보드 선택 메시지=`useClipboardMessages().selectedMessage`.
- AI 엔드포인트: `http://localhost:11434/v1/chat/completions`, 모델 `gemma4:e4b`, OpenAI 호환. 응답: `choices[0].message.content`.
- System Prompt(회사 규칙, 스펙 §9): 핵심만 / 일정 우선 / 영향 범위 / 작업 내용 / 담당자 마지막 / 존댓말 / 불필요한 인삿말 제거 / 가독성 불릿 / **반드시 지정 언어로만 출력**.
- 검증: **복사한 메시지 미선택 시 공지 생성 누르면 피드백**(생성 진행 안 함). 생성 실패 시 에러 표시 + 다시 시도.
- 들여쓰기 스페이스, `<script setup lang="ts">`, data-test 훅. 커밋 `feat|fix` + 한글 + **Co-Authored-By 절대 금지**. 한글 주석.
- 이 Plan 범위: 생성/재생성/AI수정/복사/수정 + 미선택 검증. 최근 기록·로그는 다음 Plan.

---

### Task 1: Rust AI 커맨드 (generate_notice / refine_notice)

**Files:**
- Create: `src-tauri/src/ai.rs`
- Modify: `src-tauri/src/lib.rs` (mod ai + invoke_handler 등록)
- Modify: `src-tauri/Cargo.toml` (reqwest 의존)

**Interfaces:**
- Produces (Tauri commands, 프론트에서 invoke):
  - `generate_notice(message: String, prompt: String, language: String) -> Result<String, String>`
  - `refine_notice(current: String, instruction: String, language: String) -> Result<String, String>`

- [ ] **Step 1: reqwest 추가**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo add reqwest --features json
```
(엔드포인트가 http localhost라 TLS 불필요. 기본 features로 충분.)

- [ ] **Step 2: ai.rs 구현**

Create `src-tauri/src/ai.rs`:
```rust
use serde::{Deserialize, Serialize};

// Ollama OpenAI 호환 엔드포인트 / 모델 (추후 llama-server로 교체 가능)
const AI_URL: &str = "http://localhost:11434/v1/chat/completions";
const MODEL: &str = "gemma4:e4b";

// 회사 공지 작성 규칙 (스펙 §9)
const SYSTEM_PROMPT: &str = "너는 회사 공지 작성 도우미다. 규칙: 핵심 내용만, 일정 우선, 영향 범위 명시, 작업 내용 정리, 담당자는 마지막, 존댓말, 불필요한 인삿말 제거, 가독성 높은 불릿 사용. 공지 유형은 내용에 맞게 스스로 판단한다. 반드시 지정된 언어로만 출력한다.";

#[derive(Serialize, Deserialize, Clone)]
struct Msg {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatReq {
    model: String,
    messages: Vec<Msg>,
    stream: bool,
    temperature: f32,
}

#[derive(Deserialize)]
struct Choice {
    message: Msg,
}

#[derive(Deserialize)]
struct ChatResp {
    choices: Vec<Choice>,
}

// 공통 호출부
async fn call_ai(messages: Vec<Msg>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = ChatReq {
        model: MODEL.to_string(),
        messages,
        stream: false,
        temperature: 0.4,
    };
    let resp = client
        .post(AI_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI 서버 연결 실패 (Ollama 실행 중인지 확인): {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AI 서버 오류: {}", resp.status()));
    }
    let data: ChatResp = resp
        .json()
        .await
        .map_err(|e| format!("AI 응답 파싱 실패: {e}"))?;
    data.choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "AI 응답이 비어 있습니다".to_string())
}

// 공지 생성: 원본 메시지 + 지시(프롬프트) + 언어
#[tauri::command]
pub async fn generate_notice(
    message: String,
    prompt: String,
    language: String,
) -> Result<String, String> {
    let user = format!(
        "원본 메시지:\n{message}\n\n지시:\n{prompt}\n\n출력 언어: {language}"
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    call_ai(messages).await
}

// AI 수정: 현재 공지 + 수정 지시
#[tauri::command]
pub async fn refine_notice(
    current: String,
    instruction: String,
    language: String,
) -> Result<String, String> {
    let user = format!(
        "아래 공지를 다음 지시에 맞게 다시 작성해줘. 언어는 {language}로 유지.\n\n[현재 공지]\n{current}\n\n[지시]\n{instruction}"
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    call_ai(messages).await
}
```

- [ ] **Step 3: lib.rs에 등록**

`src-tauri/src/lib.rs` 상단에 `mod ai;` 추가하고, `invoke_handler`의 `generate_handler!` 목록에 두 커맨드 추가(기존 `greet` 유지):
```rust
mod ai;
// ...
        .invoke_handler(tauri::generate_handler![greet, ai::generate_notice, ai::refine_notice])
```
(기존 `.plugin(...)`, `.on_window_event`, `.setup` 등 체인 라인 유지.)

- [ ] **Step 4: 빌드 확인**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo build
```
Expected: 컴파일 성공(에러 없음).

- [ ] **Step 5: 실제 호출 스모크 검증(Ollama 필요)**

Ollama가 떠 있으면(`curl -s http://localhost:11434/api/tags`로 확인) 실제 커맨드 경로를 간이 검증하기 위해 아래 curl로 동등 요청이 되는지 확인(참고용, 커맨드 자체는 앱 구동에서 최종 검증):
```bash
curl -s -m 90 http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"gemma4:e4b","messages":[{"role":"user","content":"안녕"}],"stream":false}' | head -c 200
```
Expected: `choices[0].message.content` 포함된 JSON. (앱 실행 시 컨트롤러가 실제 생성으로 최종 검증.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/
git commit -m "feat: AI 공지 생성 Rust 커맨드 추가

- ai.rs: Ollama OpenAI 호환 API(gemma4:e4b) 호출
- generate_notice/refine_notice 커맨드, 회사 공지 규칙 시스템 프롬프트
- lib.rs 등록, reqwest 의존 추가"
```

---

### Task 2: 프론트 생성 흐름 (useGeneration + MainView 검증/트리거 + ResultView 결과/액션)

**Files:**
- Create: `src/composables/useGeneration.ts`, `src/composables/useGeneration.test.ts`
- Modify: `src/views/MainView.vue`, `src/views/MainView.test.ts`
- Modify: `src/views/ResultView.vue`

**Interfaces:**
- Consumes: Task 1 커맨드(`generate_notice`, `refine_notice`) via invoke; `useClipboardMessages().selectedMessage`, `usePrompts`, `LANGUAGES`.
- Produces: `useGeneration()` → `state {status: "idle"|"loading"|"success"|"error", result, error}`, `generate(message,prompt,language)`, `regenerate()`, `refine(instruction)`, `setResult(text)`.

- [ ] **Step 1: useGeneration 실패 테스트**

Create `src/composables/useGeneration.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// @tauri-apps/api/core invoke 모킹
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { useGeneration } from "./useGeneration";

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
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — `./useGeneration` 없음.

- [ ] **Step 3: useGeneration 구현**

Create `src/composables/useGeneration.ts`:
```ts
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";

type Status = "idle" | "loading" | "success" | "error";

// 앱 전역 단일 생성 상태
const state = reactive({
  status: "idle" as Status,
  result: "",
  error: "",
});

// 직전 생성 입력 (다시 생성용)
let last = { message: "", prompt: "", language: "한국어" };

export function useGeneration() {
  // 공지 생성
  const generate = async (message: string, prompt: string, language: string): Promise<void> => {
    last = { message, prompt, language };
    state.status = "loading";
    state.error = "";
    try {
      state.result = await invoke<string>("generate_notice", { message, prompt, language });
      state.status = "success";
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  // 직전 입력으로 다시 생성
  const regenerate = (): Promise<void> => generate(last.message, last.prompt, last.language);

  // 현재 결과를 지시대로 AI 수정
  const refine = async (instruction: string): Promise<void> => {
    state.status = "loading";
    state.error = "";
    try {
      state.result = await invoke<string>("refine_notice", {
        current: state.result,
        instruction,
        language: last.language,
      });
      state.status = "success";
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  // 수동 편집 반영
  const setResult = (text: string): void => {
    state.result = text;
  };

  return { state, generate, regenerate, refine, setResult };
}
```

- [ ] **Step 4: MainView 검증/트리거 테스트 추가(실패 확인)**

`src/views/MainView.test.ts`의 `describe("MainView", ...)` 안에 아래 테스트 추가(기존 유지):
```ts
  it("메시지 미선택 시 공지 생성하면 검증 피드백을 보여주고 generate 이벤트를 내지 않는다", async () => {
    const cb = useClipboardMessages();
    cb.clear();
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="generate-btn"]').trigger("click");
    expect(wrapper.find('[data-test="validation-error"]').exists()).toBe(true);
    expect(wrapper.emitted("generate")).toBeFalsy();
  });
```
(파일 상단 import에 `useClipboardMessages`가 이미 있으면 재사용.)

- [ ] **Step 5: MainView 트리거/검증 구현**

`src/views/MainView.vue` script에 생성 연결 + 검증 추가, template의 "공지 생성" 버튼 아래에 검증 메시지 추가. (프롬프트/클립보드/언어 기존 구조 유지.)

script `<script setup lang="ts">`에 추가/수정:
```ts
import { useGeneration } from "../composables/useGeneration";

const { selectedMessage } = useClipboardMessages(); // 기존 구조에서 selectedMessage 추가 획득
const { generate } = useGeneration();

// 검증 피드백
const validationError = ref<string>("");

// 공지 생성: 메시지 선택 검증 후 생성 트리거
const emitGenerate = (): void => {
  if (!selectedMessage.value) {
    validationError.value = "복사한 메시지를 먼저 선택해주세요.";
    return;
  }
  validationError.value = "";
  // 실제 생성 시작(비동기) 후 결과 화면으로 전환
  generate(selectedMessage.value.text, promptContent.value, language.value);
  emit("generate");
};
```
(기존 `useClipboardMessages()` 구조 분해에 `selectedMessage`를 추가한다. `emitGenerate`는 기존 것을 이 내용으로 대체.)

template의 공지 생성 버튼 부분:
```vue
    <!-- 공지 생성 -->
    <button data-test="generate-btn" class="generate-btn" @click="emitGenerate">공지 생성</button>
    <p v-if="validationError" class="validation-error" data-test="validation-error">{{ validationError }}</p>
```

scoped 스타일에 추가:
```css
.validation-error {
  margin: 0;
  color: #e5484d;
  font-size: 13px;
}
```

- [ ] **Step 6: ResultView 결과/로딩/에러/액션 구현**

Replace `src/views/ResultView.vue` 전체:
```vue
<template>
  <section class="result-view">
    <h1>생성된 공지</h1>

    <!-- 로딩 -->
    <p v-if="state.status === 'loading'" class="status" data-test="status-loading">AI가 공지를 생성 중입니다…</p>

    <!-- 에러 -->
    <div v-else-if="state.status === 'error'" class="status error" data-test="status-error">
      <p>{{ state.error }}</p>
      <button data-test="retry-btn" @click="regenerate">다시 시도</button>
    </div>

    <!-- 결과 -->
    <template v-else>
      <textarea
        class="preview"
        data-test="preview"
        :value="state.result"
        @input="onEdit"
        placeholder="여기에 생성된 공지가 표시됩니다."
      ></textarea>

      <!-- AI 수정 지시 -->
      <div class="refine-row">
        <input v-model="refineText" data-test="refine-input" placeholder="AI 수정 지시 (예: 더 짧게, 더 정중하게)" />
        <button data-test="refine-btn" @click="onRefine">AI 수정</button>
      </div>
    </template>

    <div class="actions">
      <button data-test="regenerate-btn" @click="regenerate">다시 생성</button>
      <button data-test="copy-btn" @click="onCopy">{{ copied ? "복사됨!" : "복사" }}</button>
      <button data-test="back-btn" @click="emitBack">← 뒤로</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useGeneration } from "../composables/useGeneration";

const emit = defineEmits<{ (e: "back"): void }>();

const { state, regenerate, refine, setResult } = useGeneration();

const refineText = ref<string>("");
const copied = ref<boolean>(false);

// 편집 반영
const onEdit = (e: Event): void => {
  setResult((e.target as HTMLTextAreaElement).value);
};

// AI 수정 실행
const onRefine = (): void => {
  const t = refineText.value.trim();
  if (!t) return;
  refine(t);
  refineText.value = "";
};

// 클립보드 복사
const onCopy = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(state.result);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // 실패 시 무시(브라우저 권한 등)
  }
};

const emitBack = (): void => {
  emit("back");
};
</script>

<style scoped>
.result-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  max-width: 720px;
  margin: 0 auto;
}
h1 {
  font-size: 22px;
  margin: 0;
}
.status {
  color: var(--muted);
  font-size: 14px;
}
.status.error {
  color: #e5484d;
}
.preview {
  min-height: 260px;
  font: inherit;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  resize: vertical;
}
.refine-row {
  display: flex;
  gap: 8px;
}
.refine-row input {
  flex: 1;
  font: inherit;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button,
.refine-row button,
.status button {
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.actions button:hover,
.refine-row button:hover {
  border-color: var(--primary);
}
</style>
```

- [ ] **Step 7: 테스트 + 빌드**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
npm run build
```
Expected: 테스트 PASS(useGeneration + MainView 검증 포함), 빌드 green. `@tauri-apps/api`가 devDependency에 없으면 이미 스캐폴드에 있음(확인). invoke 모킹으로 jsdom에서 안전.

- [ ] **Step 8: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add -A
git commit -m "feat: AI 공지 생성 흐름 연결

- useGeneration: generate/regenerate/refine 상태 관리(invoke)
- MainView: 메시지 미선택 시 검증 피드백 후 생성 트리거
- ResultView: 로딩/에러/결과 렌더, 수정/복사/다시생성/AI수정"
```

---

## 완료 기준 (Plan 5)

- 복사한 메시지 선택 + 공지 생성 → 실제 Gemma 4가 공지문 생성, 결과 화면에 표시.
- **메시지 미선택 시 공지 생성 → "복사한 메시지를 먼저 선택해주세요" 피드백**, 생성 안 함.
- 결과 편집 가능, 복사·다시 생성·AI 수정(지시로 재작성) 동작. 생성 실패 시 에러 + 다시 시도.
- `npm test` 통과, `npm run build` 그린, `cargo build` 성공.

## 다음 Plan 예고 (범위 아님)

- Plan 6: 최근 생성 기록 20건 + 로그(시간/유형/성공/응답시간, 원문 미저장), 온디맨드 모델 수명주기(Ollama가 대부분 처리), 배포용 llama-server 사이드카 전환.
