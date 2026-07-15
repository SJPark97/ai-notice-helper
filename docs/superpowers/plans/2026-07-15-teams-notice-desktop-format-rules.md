# AI 공지 도우미 — Plan 9: 출력 형식 선택 + 전역 규칙 탭

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** (1) 공지 출력 형식을 선택(일반 텍스트/마크다운/HTML)해 문서 에디터에 맞게 뽑고, (2) 프롬프트와 별개로 항상 적용되는 "전역 규칙"을 탭에서 관리해 매 생성에 자동 포함한다.

**Architecture:** 형식·전역 규칙을 생성 요청에 추가한다. Rust `generate_notice`/`refine_notice`가 `format`, `global_rules`를 받아 프롬프트에 주입. 프론트는 `FORMATS` 상수 + MainView 형식 드롭다운, `useGlobalRules`(localStorage) + App 상단 탭([공지 생성]/[전역 규칙]) + `GlobalRulesView`. `useGeneration`이 형식·전역규칙을 invoke로 전달.

**Tech Stack:** Rust, Vue 3 `<script setup lang="ts">`, localStorage, Vitest.

## Global Constraints

- Plan 1~8 위(main). ai.rs generate_notice(message,prompt,language)/refine_notice(current,instruction,language) 기존. useGeneration.generate(message,prompt,language)/refine(instruction). MainView는 language ref + prompt UI + 생성 트리거. App은 screen main/result 토글 + 테마토글 + useClipboardWatch.
- 출력 형식: `plain`(기본, 별표 없는 순수 텍스트) / `markdown` / `html`. 문서 에디터 타겟이라 기본은 plain.
- 전역 규칙: 자유 텍스트, localStorage 키 `"ai-notice:globalRules"`, 매 생성/수정에 자동 포함. 비어 있으면 생략.
- Tauri는 JS camelCase invoke 인자를 Rust snake_case로 매핑(`globalRules`→`global_rules`).
- 들여쓰기 스페이스, `<script setup lang="ts">`, data-test 훅. 커밋 `feat` + 한글 + **Co-Authored-By 절대 금지**. 한글 주석.
- 범위: 형식 + 전역 규칙. 스트리밍/배포는 범위 밖.

---

### Task 1: Rust — format / global_rules 주입

**Files:**
- Modify: `src-tauri/src/ai.rs`

**Interfaces:**
- Produces: `generate_notice(message, prompt, language, format, global_rules) -> Result<String,String>`, `refine_notice(current, instruction, language, format, global_rules) -> Result<String,String>`.

- [ ] **Step 1: ai.rs에 형식 규칙 헬퍼 + 파라미터 추가**

`src-tauri/src/ai.rs` 수정. 형식 지시 헬퍼 추가하고 두 커맨드에 `format`/`global_rules` 파라미터를 추가해 user content에 주입한다(SYSTEM_PROMPT, call_ai 등 기존 유지):
```rust
// 출력 형식별 지시문
fn format_rule(format: &str) -> &'static str {
    match format {
        "markdown" => "출력은 마크다운 형식으로 작성한다(강조 **, 불릿 -).",
        "html" => "출력은 HTML로 작성한다(<b>, <ul>, <li> 등 태그 사용).",
        _ => "출력은 마크다운 문법이나 별표(*, **) 없이 순수 일반 텍스트로 작성한다. 항목 구분은 • 또는 - 불릿과 줄바꿈으로만 한다.",
    }
}

// 전역 규칙 블록(비어 있으면 빈 문자열)
fn rules_block(global_rules: &str) -> String {
    let r = global_rules.trim();
    if r.is_empty() {
        String::new()
    } else {
        format!("전역 규칙(항상 적용):\n{r}\n\n")
    }
}
```
`generate_notice`를 아래로 교체:
```rust
#[tauri::command]
pub async fn generate_notice(
    message: String,
    prompt: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<String, String> {
    let user = format!(
        "{rules}원본 메시지:\n{message}\n\n지시:\n{prompt}\n\n{fmt}\n출력 언어: {language}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    call_ai(messages).await
}
```
`refine_notice`를 아래로 교체:
```rust
#[tauri::command]
pub async fn refine_notice(
    current: String,
    instruction: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<String, String> {
    let user = format!(
        "{rules}아래 공지를 다음 지시에 맞게 다시 작성해줘. 언어는 {language}로 유지.\n{fmt}\n\n[현재 공지]\n{current}\n\n[지시]\n{instruction}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    call_ai(messages).await
}
```

- [ ] **Step 2: 빌드 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo build
```
Expected: 컴파일 성공(에러 없음).

- [ ] **Step 3: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/src/ai.rs
git commit -m "feat: 생성 커맨드에 출력 형식·전역 규칙 주입

- generate_notice/refine_notice에 format/global_rules 파라미터 추가
- 형식(plain/markdown/html) 지시 및 전역 규칙 블록을 프롬프트에 포함"
```

---

### Task 2: 프론트 로직 — FORMATS / useGlobalRules / useGeneration 전달

**Files:**
- Modify: `src/constants/notice.ts` (FORMATS 추가)
- Create: `src/composables/useGlobalRules.ts`, `src/composables/useGlobalRules.test.ts`
- Modify: `src/composables/useGeneration.ts`, `src/composables/useGeneration.test.ts`

**Interfaces:**
- Produces:
  - `FORMATS: readonly {value,label}[]` = plain/markdown/html
  - `useGlobalRules()` → `state.rules: string`, `setRules(text)`
  - `useGeneration().generate(message, prompt, language, format)` (format 인자 추가; 전역규칙은 내부에서 useGlobalRules로 읽어 invoke에 포함), `refine(instruction)`은 last.format/전역규칙 사용.

- [ ] **Step 1: FORMATS 상수 추가**

`src/constants/notice.ts`에 추가(기존 NOTICE_TYPES/LANGUAGES 유지):
```ts
// 출력 형식 (문서 에디터 타겟이라 기본 plain)
export const FORMATS = [
  { value: "plain", label: "일반 텍스트" },
  { value: "markdown", label: "마크다운" },
  { value: "html", label: "HTML" },
] as const;
```

- [ ] **Step 2: useGlobalRules 실패 테스트 + 구현**

Create `src/composables/useGlobalRules.test.ts`:
```ts
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
```
Run `npm test` → RED. 그 후 Create `src/composables/useGlobalRules.ts`:
```ts
import { reactive } from "vue";

const STORAGE_KEY = "ai-notice:globalRules";

// 앱 전역 단일 상태 (모든 생성에 적용되는 규칙)
const state = reactive({ rules: localStorage.getItem(STORAGE_KEY) ?? "" });

export function useGlobalRules() {
  // 규칙 저장(상태 + localStorage)
  const setRules = (text: string): void => {
    state.rules = text;
    localStorage.setItem(STORAGE_KEY, text);
  };

  return { state, setRules };
}
```
Run `npm test` → GREEN.

- [ ] **Step 3: useGeneration 형식/전역규칙 전달 테스트(실패 확인)**

`src/composables/useGeneration.test.ts` 수정 — 기존 테스트의 `generate(...)` 호출에 format 인자 추가하고, invoke 호출 인자 단언에 format/globalRules 포함. 상단에 `import { useGlobalRules } from "./useGlobalRules";` 추가. 예: 첫 성공 테스트를
```ts
  it("generate 성공 시 결과와 success 상태", async () => {
    useGlobalRules().setRules("");
    invokeMock.mockResolvedValue("📢 배포 공지\n- 내용");
    await g.generate("메시지", "3줄로", "한국어", "plain");
    expect(g.state.status).toBe("success");
    expect(invokeMock).toHaveBeenCalledWith("generate_notice", {
      message: "메시지",
      prompt: "3줄로",
      language: "한국어",
      format: "plain",
      globalRules: "",
    });
  });
```
로 바꾸고, 나머지 generate/regenerate/refine 테스트도 format 인자와 invoke 단언을 같은 방식으로 갱신(regenerate는 마지막 format 유지, refine은 refine_notice 인자에 format/globalRules 포함).

- [ ] **Step 4: useGeneration 구현 수정**

`src/composables/useGeneration.ts` 수정:
```ts
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useHistory } from "./useHistory";
import { useGlobalRules } from "./useGlobalRules";

type Status = "idle" | "loading" | "success" | "error";

// state.format은 결과 미리보기(Task 4)가 형식별 렌더를 위해 읽는다
const state = reactive({ status: "idle" as Status, result: "", error: "", format: "plain" });

let last = { message: "", prompt: "", language: "한국어", format: "plain" };

export function useGeneration() {
  const { addRecord } = useHistory();
  const { state: rulesState } = useGlobalRules();

  const generate = async (
    message: string,
    prompt: string,
    language: string,
    format: string,
  ): Promise<void> => {
    last = { message, prompt, language, format };
    state.format = format;
    state.status = "loading";
    state.error = "";
    const start = Date.now();
    try {
      state.result = await invoke<string>("generate_notice", {
        message,
        prompt,
        language,
        format,
        globalRules: rulesState.rules,
      });
      state.status = "success";
      addRecord(state.result, language, Date.now() - start);
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  const regenerate = (): Promise<void> =>
    generate(last.message, last.prompt, last.language, last.format);

  const refine = async (instruction: string): Promise<void> => {
    state.status = "loading";
    state.error = "";
    const start = Date.now();
    try {
      state.result = await invoke<string>("refine_notice", {
        current: state.result,
        instruction,
        language: last.language,
        format: last.format,
        globalRules: rulesState.rules,
      });
      state.status = "success";
      addRecord(state.result, last.language, Date.now() - start);
    } catch (e) {
      state.status = "error";
      state.error = String(e);
    }
  };

  const setResult = (text: string): void => {
    state.result = text;
  };

  return { state, generate, regenerate, refine, setResult };
}
```

- [ ] **Step 5: 통과 확인 + 빌드**

Run: `cd /Users/sjpark/Documents/project/ai && npm test && npm run build`
Expected: 전부 PASS(형식/전역규칙 반영), 빌드 green.

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/constants/notice.ts src/composables/useGlobalRules.ts src/composables/useGlobalRules.test.ts src/composables/useGeneration.ts src/composables/useGeneration.test.ts
git commit -m "feat: 출력 형식·전역 규칙 생성 입력 연결

- FORMATS 상수(plain/markdown/html), useGlobalRules(localStorage) 추가
- useGeneration이 format·전역규칙을 generate_notice/refine_notice에 전달"
```

---

### Task 3: UI — MainView 형식 드롭다운 + App 탭 + GlobalRulesView

**Files:**
- Modify: `src/views/MainView.vue`, `src/views/MainView.test.ts`
- Create: `src/views/GlobalRulesView.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: FORMATS, useGlobalRules, useGeneration.
- Produces: MainView에 형식 드롭다운(생성 시 format 전달). App 상단 탭 [공지 생성]/[전역 규칙], 전역 규칙 탭에서 규칙 편집·저장.

- [ ] **Step 1: MainView 형식 드롭다운 테스트(실패 확인)**

`src/views/MainView.test.ts`의 `describe("MainView", ...)`에 추가:
```ts
  it("출력 형식 드롭다운이 있다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="format"]').exists()).toBe(true);
  });
```

- [ ] **Step 2: MainView에 형식 드롭다운 + generate에 format 전달**

`src/views/MainView.vue` script: FORMATS import, format ref 추가, emitGenerate에서 format 전달.
```ts
import { LANGUAGES, FORMATS } from "../constants/notice";
// ...
const format = ref<string>(FORMATS[0].value);
// ...
const emitGenerate = (): void => {
  if (!selectedMessage.value) {
    validationError.value = "복사한 메시지를 먼저 선택해주세요.";
    return;
  }
  validationError.value = "";
  generate(selectedMessage.value.text, promptContent.value, language.value, format.value);
  emit("generate");
};
```
template: 언어 드롭다운 아래(또는 위)에 형식 추가:
```vue
    <!-- 출력 형식 -->
    <label>출력 형식</label>
    <select v-model="format" data-test="format">
      <option v-for="f in FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
    </select>
```

- [ ] **Step 3: GlobalRulesView 생성**

Create `src/views/GlobalRulesView.vue`:
```vue
<template>
  <section class="rules-view">
    <h1>전역 규칙</h1>
    <p class="desc">모든 공지 생성에 항상 적용되는 규칙입니다. (프롬프트와 별개)</p>
    <textarea
      class="rules-input"
      data-test="global-rules"
      :value="state.rules"
      @input="onInput"
      placeholder="예) 회사명은 인투씨엔에스로 표기. 항상 존댓말. 담당자는 맨 마지막에 '문의: 이름'."
    ></textarea>
    <p class="saved" data-test="rules-saved">자동 저장됨</p>
  </section>
</template>

<script setup lang="ts">
import { useGlobalRules } from "../composables/useGlobalRules";

const { state, setRules } = useGlobalRules();

// 입력 즉시 저장
const onInput = (e: Event): void => {
  setRules((e.target as HTMLTextAreaElement).value);
};
</script>

<style scoped>
.rules-view {
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
.desc {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}
.rules-input {
  min-height: 300px;
  font: inherit;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  resize: vertical;
}
.saved {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
  align-self: flex-end;
}
</style>
```

- [ ] **Step 4: App에 상단 탭 추가**

`src/App.vue` 수정 — 탭 상태와 GlobalRulesView 추가(기존 screen 토글·테마토글·useClipboardWatch 유지):
```vue
<template>
  <button class="theme-toggle" type="button" data-test="theme-toggle" @click="toggleTheme">
    {{ theme === "dark" ? "☀️" : "🌙" }}
  </button>

  <!-- 상단 탭 -->
  <nav class="tabs">
    <button :class="{ active: tab === 'notice' }" data-test="tab-notice" @click="tab = 'notice'">공지 생성</button>
    <button :class="{ active: tab === 'rules' }" data-test="tab-rules" @click="tab = 'rules'">전역 규칙</button>
  </nav>

  <template v-if="tab === 'notice'">
    <MainView v-if="screen === 'main'" @generate="screen = 'result'" />
    <ResultView v-else @back="screen = 'main'" />
  </template>
  <GlobalRulesView v-else />
</template>

<script setup lang="ts">
import { ref } from "vue";
import MainView from "./views/MainView.vue";
import ResultView from "./views/ResultView.vue";
import GlobalRulesView from "./views/GlobalRulesView.vue";
import { useClipboardWatch } from "./composables/useClipboardWatch";
import { useTheme } from "./composables/useTheme";

useClipboardWatch();

const { theme, toggleTheme, initTheme } = useTheme();
initTheme();

// 상단 탭 (notice | rules)
const tab = ref<"notice" | "rules">("notice");
// 공지 화면 상태 (main | result)
const screen = ref<"main" | "result">("main");
</script>

<style>
/* 기존 :root 변수/팔레트/body/.theme-toggle 유지하고 아래 탭 스타일 추가 */
.tabs {
  display: flex;
  gap: 4px;
  padding: 10px 20px 0;
  max-width: 720px;
  margin: 0 auto;
}
.tabs button {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
}
.tabs button.active {
  color: var(--text);
  background: var(--surface);
  border-bottom: 2px solid var(--primary);
}
</style>
```
(Step 4의 App `<style>`는 기존 전역 블록에 `.tabs` 규칙만 추가하고 나머지는 보존.)

- [ ] **Step 5: 테스트 + 빌드**

Run: `cd /Users/sjpark/Documents/project/ai && npm test && npm run build`
Expected: 전부 PASS(형식 드롭다운 테스트 포함, 기존 테스트 유지), 빌드 green.

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add -A
git commit -m "feat: 출력 형식 드롭다운 및 전역 규칙 탭 UI

- MainView에 출력 형식 선택(일반텍스트/마크다운/HTML) 추가, 생성 시 전달
- App 상단 탭(공지 생성/전역 규칙) + GlobalRulesView(자동 저장) 추가"
```

---

### Task 4: ResultView 편집/미리보기 토글 (형식별 렌더)

**Files:**
- Modify: `src/views/ResultView.vue`
- Modify: `package.json` (marked 의존)

**Interfaces:**
- Consumes: useGeneration `state.result`, `state.format`(Task 2). 로직/기존 상태(loading 스피너/error/refine/copy/regenerate/back) 유지.

- [ ] **Step 1: marked 설치**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm i marked
```

- [ ] **Step 2: ResultView 성공 블록에 편집/미리보기 토글 + 렌더 추가**

`src/views/ResultView.vue` 수정. **loading(스피너)·error 블록은 그대로 두고**, 성공(`<template v-else>`) 블록만 아래 구조로 교체(편집=기존 textarea, 미리보기=형식별 렌더). refine-row와 하단 actions는 유지:
```vue
    <!-- 결과 -->
    <template v-else>
      <!-- 편집/미리보기 토글 -->
      <div class="view-toggle">
        <button :class="{ active: viewMode === 'edit' }" type="button" data-test="mode-edit" @click="viewMode = 'edit'">편집</button>
        <button :class="{ active: viewMode === 'preview' }" type="button" data-test="mode-preview" @click="viewMode = 'preview'">미리보기</button>
      </div>

      <!-- 편집 -->
      <textarea
        v-if="viewMode === 'edit'"
        class="preview"
        data-test="preview"
        :value="state.result"
        @input="onEdit"
        placeholder="여기에 생성된 공지가 표시됩니다."
      ></textarea>

      <!-- 미리보기 (형식별 렌더) -->
      <div v-else class="rendered" data-test="rendered">
        <pre v-if="state.format === 'plain'" class="rendered-plain">{{ state.result }}</pre>
        <div v-else class="rendered-rich" v-html="previewHtml"></div>
      </div>

      <!-- AI 수정 지시 -->
      <div class="refine-row">
        <input v-model="refineText" data-test="refine-input" placeholder="AI 수정 지시 (예: 더 짧게, 더 정중하게)" />
        <button data-test="refine-btn" @click="onRefine">AI 수정</button>
      </div>
    </template>
```

- [ ] **Step 3: script에 viewMode + previewHtml 추가**

`src/views/ResultView.vue`의 `<script setup lang="ts">`에 추가(기존 state/regenerate/refine/setResult, refineText/copied/onEdit/onRefine/onCopy/emitBack 유지):
```ts
import { ref, computed } from "vue";
import { marked } from "marked";
// ... 기존 import 유지 ...

// 편집 / 미리보기 모드
const viewMode = ref<"edit" | "preview">("edit");

// 형식별 미리보기 HTML (plain은 v-html 미사용)
const previewHtml = computed<string>(() => {
  if (state.format === "html") return state.result;
  if (state.format === "markdown") return marked.parse(state.result, { async: false }) as string;
  return "";
});
```
(파일 상단 `import { ref } from "vue";`가 이미 있으면 `computed`만 추가.)

- [ ] **Step 4: 스타일 추가**

`<style scoped>`에 추가(기존 유지):
```css
.view-toggle {
  display: flex;
  gap: 4px;
}
.view-toggle button {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}
.view-toggle button.active {
  color: var(--primary-text);
  background: var(--primary);
  border-color: var(--primary);
}
.rendered {
  min-height: 260px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  overflow: auto;
}
.rendered-plain {
  margin: 0;
  font: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}
.rendered-rich {
  line-height: 1.6;
}
.rendered-rich :first-child {
  margin-top: 0;
}
</style>
```

- [ ] **Step 5: 테스트 + 빌드**

Run: `cd /Users/sjpark/Documents/project/ai && npm test && npm run build`
Expected: 전부 PASS(기존 테스트 유지, `status-loading`/`preview` 훅 보존), 빌드 green. marked 타입 이슈 시 `as string` 캐스팅 확인.

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/views/ResultView.vue package.json package-lock.json
git commit -m "feat: 결과 편집/미리보기 토글 및 형식별 렌더

- ResultView에 편집/미리보기 토글 추가
- 마크다운(marked 렌더)/HTML(v-html)/일반텍스트(pre-wrap) 형식별 미리보기"
```

---

## 완료 기준 (Plan 9)

- 출력 형식을 "일반 텍스트"로 두면 별표(`*`,`**`) 없는 깔끔한 텍스트가 나와 문서 에디터에 바로 붙여넣기 좋다. 마크다운/HTML 선택 시 각 형식으로 나온다.
- 상단 "전역 규칙" 탭에서 규칙을 적으면 자동 저장되고, 모든 공지 생성/AI수정에 자동 포함된다(앱 재시작 후에도 유지).
- `npm test` 통과, `npm run build` 그린, `cargo build` 성공.

## 다음 (범위 아님)

- **Plan 10(바로 다음): 스트리밍 생성** — Rust가 Ollama `stream: true` 응답을 토큰 단위로 읽어 Tauri 이벤트로 emit, 프론트가 실시간 누적 표시. 이 Plan의 format/global_rules/미리보기를 그대로 재사용.
- Ollama 없이 배포(llama-server 번들).
