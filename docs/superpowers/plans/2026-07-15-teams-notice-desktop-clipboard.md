# AI 공지 도우미 — Plan 2: 클립보드 감시 & 메시지 선택 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 클립보드에 복사된 텍스트를 자동으로 감지해 "복사한 메시지" 리스트에 쌓고, 사용자가 하나를 선택할 수 있게 한다. (붙여넣기 동작 없이 복사만으로 리스트에 등장)

**Architecture:** `tauri-plugin-clipboard`(CrossCopy)로 클립보드 변경을 감시한다. 순수 상태·로직은 Tauri에 의존하지 않는 컴포저블 `useClipboardMessages`(단위 테스트 가능)로 분리하고, Tauri 이벤트 구독 글루(`useClipboardWatch`)가 감지된 텍스트를 그 컴포저블에 밀어넣는다. App 루트에서 앱 생애 1회 감시를 시작하고, MainView가 공유 상태를 렌더한다.

**Tech Stack:** Tauri 2, `tauri-plugin-clipboard`(Rust) + `tauri-plugin-clipboard-api`(npm), Vue 3 `<script setup lang="ts">` composable, Vitest.

## Global Constraints

- Plan 1 위에서 작업. 앱 이름 "AI 공지 도우미", 크레이트 `ai-notice`/lib `ai_notice_lib`, 메인 윈도우 label `"main"`.
- 이 프로젝트 들여쓰기 = **스페이스**(스캐폴드 일관). 컴포넌트 `<script setup lang="ts">`, 파일 PascalCase(.vue)/camelCase(.ts). data-test 훅 유지.
- 커밋 컨벤션: `feat|fix|chore|docs|refactor|build` 프리픽스 + 한글 제목/본문, **Co-Authored-By 절대 금지**.
- 코드 주석 한글.
- 프라이버시: 최근 **최대 20개**만 메모리 보관, 언제든 전체 비우기, 감시 on/off 토글. 원본 메시지는 디스크에 저장하지 않는다(메모리만).
- 이 Plan 범위: 클립보드 **텍스트** 감지→리스트→선택까지. AI 생성·결과 액션·HTML 작성자/시간 파싱은 범위 밖(후속). 선택된 메시지는 후속 Plan(생성)이 읽어갈 수 있게 노출만 한다.

---

### Task 1: 클립보드 플러그인 설치·등록·권한

**Files:**
- Modify: `src-tauri/Cargo.toml` (deps: tauri-plugin-clipboard)
- Modify: `package.json` (deps: tauri-plugin-clipboard-api)
- Modify: `src-tauri/src/lib.rs` (플러그인 등록)
- Modify: `src-tauri/capabilities/default.json` (권한)

**Interfaces:**
- Produces: 앱에 클립보드 플러그인이 등록되고 프론트에서 `tauri-plugin-clipboard-api`를 import 가능. 프론트 API: `startListening()`, `onTextUpdate(cb)`, `readText()` (Task 3에서 사용).

- [ ] **Step 1: Rust 플러그인 추가**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo add tauri-plugin-clipboard
```
Expected: `Cargo.toml`에 `tauri-plugin-clipboard = "..."` 추가.

- [ ] **Step 2: 프론트 플러그인 추가**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm i tauri-plugin-clipboard-api
```
Expected: `package.json` dependencies에 `tauri-plugin-clipboard-api` 추가.

- [ ] **Step 3: lib.rs에 플러그인 등록**

`src-tauri/src/lib.rs`의 `tauri::Builder::default()` 체인에 `.plugin(tauri_plugin_clipboard::init())` 추가(기존 `.plugin(tauri_plugin_opener::init())`, `.on_window_event`, `.setup`, `.invoke_handler` 라인은 **그대로 유지**하고 한 줄만 추가):
```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard::init()) // 클립보드 감시 플러그인
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            // ... 기존 트레이 최소화 코드 유지 ...
```
(import은 `tauri_plugin_clipboard`를 별도 `use` 없이 경로로 호출하므로 추가 use 불필요.)

- [ ] **Step 4: 권한 추가**

`src-tauri/capabilities/default.json`의 `permissions` 배열에 클립보드 플러그인 권한을 추가한다. 플러그인이 제공하는 권한 세트를 넣되, **정확한 권한 문자열은 설치된 버전 기준으로 확인**한다(플러그인 문서/`src-tauri/gen/schemas/*` 의 clipboard 권한 목록). 최소 필요 권한:
```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "clipboard:allow-start-monitor",
    "clipboard:allow-stop-monitor",
    "clipboard:allow-is-monitor-running",
    "clipboard:allow-has-text",
    "clipboard:allow-read-text",
    "clipboard:allow-has-html",
    "clipboard:allow-read-html"
  ]
}
```
만약 위 granular 문자열이 설치 버전과 다르면, 플러그인이 제공하는 묶음 권한(`clipboard:default` 또는 `clipboard-all` 등)으로 대체한다. 판단 기준: `npm run tauri dev` 실행 시 권한 거부 에러가 안 나야 함.

- [ ] **Step 5: 빌드 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo build
```
Expected: 컴파일 성공(에러 없음).

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add -A
git commit -m "build: 클립보드 감시 플러그인 추가

- tauri-plugin-clipboard(Rust) 및 tauri-plugin-clipboard-api(프론트) 설치
- lib.rs에 플러그인 등록, capabilities에 클립보드 권한 추가"
```

---

### Task 2: useClipboardMessages 컴포저블 (순수 상태·로직, TDD)

**Files:**
- Create: `src/composables/useClipboardMessages.ts`
- Test: `src/composables/useClipboardMessages.test.ts`

**Interfaces:**
- Consumes: 없음(순수 Vue reactivity만).
- Produces: `useClipboardMessages()` 가 반환하는 API — 후속 Task/Plan이 사용:
  - `state.messages: ClipboardMessage[]` (최신순), `state.selectedId: number | null`, `state.watching: boolean`
  - `ClipboardMessage = { id: number; text: string; preview: string; capturedAt: Date }`
  - `addMessage(text: string): void`, `select(id: number): void`, `clear(): void`, `setWatching(on: boolean): void`
  - `selectedMessage: ComputedRef<ClipboardMessage | null>` (후속 생성 Plan이 읽어갈 선택 메시지)
  - 모듈 수준 단일 상태(앱 전역 공유).

- [ ] **Step 1: 실패 테스트 작성**

Create `src/composables/useClipboardMessages.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useClipboardMessages } from "./useClipboardMessages";

describe("useClipboardMessages", () => {
  const cb = useClipboardMessages();
  beforeEach(() => cb.clear());

  it("빈 문자열/공백은 무시한다", () => {
    cb.addMessage("   ");
    expect(cb.state.messages).toHaveLength(0);
  });

  it("새 메시지를 최신순으로 앞에 추가한다", () => {
    cb.addMessage("첫번째");
    cb.addMessage("두번째");
    expect(cb.state.messages[0].text).toBe("두번째");
    expect(cb.state.messages[1].text).toBe("첫번째");
  });

  it("직전과 동일한 텍스트는 중복 추가하지 않는다", () => {
    cb.addMessage("같은내용");
    cb.addMessage("같은내용");
    expect(cb.state.messages).toHaveLength(1);
  });

  it("최대 20개까지만 보관한다", () => {
    for (let i = 0; i < 25; i++) cb.addMessage(`메시지 ${i}`);
    expect(cb.state.messages).toHaveLength(20);
    expect(cb.state.messages[0].text).toBe("메시지 24");
  });

  it("preview는 80자로 자르고 말줄임표를 붙인다", () => {
    cb.addMessage("가".repeat(100));
    expect(cb.state.messages[0].preview.endsWith("…")).toBe(true);
    expect(cb.state.messages[0].preview.length).toBe(81);
  });

  it("select로 선택하면 selectedMessage가 해당 항목이 된다", () => {
    cb.addMessage("골라줘");
    cb.select(cb.state.messages[0].id);
    expect(cb.selectedMessage.value?.text).toBe("골라줘");
  });

  it("clear는 목록과 선택을 비운다", () => {
    cb.addMessage("지울거");
    cb.select(cb.state.messages[0].id);
    cb.clear();
    expect(cb.state.messages).toHaveLength(0);
    expect(cb.selectedMessage.value).toBeNull();
  });

  it("setWatching으로 감시 상태를 바꾼다", () => {
    cb.setWatching(false);
    expect(cb.state.watching).toBe(false);
    cb.setWatching(true);
    expect(cb.state.watching).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — `./useClipboardMessages` 모듈 없음.

- [ ] **Step 3: 컴포저블 구현**

Create `src/composables/useClipboardMessages.ts`:
```ts
import { reactive, computed, type ComputedRef } from "vue";

// 복사한 메시지 한 건
export interface ClipboardMessage {
  id: number;
  text: string;
  preview: string;
  capturedAt: Date;
}

// 최근 보관 최대 개수
const MAX_MESSAGES = 20;

// 앱 전역 단일 상태
const state = reactive({
  messages: [] as ClipboardMessage[],
  selectedId: null as number | null,
  watching: true,
});

let nextId = 0;

// 미리보기: 여러 줄/공백을 한 줄로 정리 후 80자 제한
const toPreview = (text: string): string => {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
};

export function useClipboardMessages() {
  // 새 클립보드 텍스트 추가 (빈 값·직전과 동일은 무시, 최신순, 최대 20개)
  const addMessage = (rawText: string): void => {
    const text = rawText.trim();
    if (!text) return;
    if (state.messages.length > 0 && state.messages[0].text === text) return;
    state.messages.unshift({
      id: ++nextId,
      text,
      preview: toPreview(text),
      capturedAt: new Date(),
    });
    if (state.messages.length > MAX_MESSAGES) {
      state.messages.splice(MAX_MESSAGES);
    }
  };

  // 메시지 선택
  const select = (id: number): void => {
    state.selectedId = id;
  };

  // 목록·선택 비우기
  const clear = (): void => {
    state.messages.splice(0);
    state.selectedId = null;
  };

  // 감시 on/off
  const setWatching = (on: boolean): void => {
    state.watching = on;
  };

  // 현재 선택된 메시지 (후속 생성 Plan에서 사용)
  const selectedMessage: ComputedRef<ClipboardMessage | null> = computed(
    () => state.messages.find((m) => m.id === state.selectedId) ?? null,
  );

  return { state, addMessage, select, clear, setWatching, selectedMessage };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: PASS (기존 4건 + useClipboardMessages 8건).

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/useClipboardMessages.ts src/composables/useClipboardMessages.test.ts
git commit -m "feat: 클립보드 메시지 상태 컴포저블 추가

- useClipboardMessages: 최신순 목록, 직전 중복 무시, 최대 20개, 선택/비우기/감시토글
- 순수 로직 단위 테스트 8건"
```

---

### Task 3: 클립보드 감시 연결 + MainView 리스트 UI

**Files:**
- Create: `src/composables/useClipboardWatch.ts`
- Modify: `src/views/MainView.vue` (리스트/토글/비우기 UI)
- Modify: `src/App.vue` (앱 생애 1회 감시 시작/정리)
- Modify: `src/views/MainView.test.ts` (리스트 렌더 테스트 추가)

**Interfaces:**
- Consumes: `useClipboardMessages`(Task 2), `tauri-plugin-clipboard-api`(Task 1: `startListening`, `onTextUpdate`).
- Produces: 앱 실행 중 클립보드에 복사된 텍스트가 MainView 리스트에 등장하고, 클릭하면 선택(하이라이트)된다. 감시 토글/전체 비우기 동작.

- [ ] **Step 1: 감시 글루 컴포저블 구현**

Create `src/composables/useClipboardWatch.ts`:
```ts
import { onMounted, onUnmounted } from "vue";
import { startListening, onTextUpdate } from "tauri-plugin-clipboard-api";
import { useClipboardMessages } from "./useClipboardMessages";

// 클립보드 변경을 구독해 감시 중일 때만 메시지를 적재한다.
// App 루트에서 1회 호출한다.
export function useClipboardWatch() {
  const { state, addMessage } = useClipboardMessages();

  let stopMonitor: (() => Promise<void>) | null = null;
  let unlistenText: (() => void) | null = null;

  onMounted(async () => {
    // 텍스트 변경 이벤트 구독: 감시 on일 때만 적재
    unlistenText = await onTextUpdate((text: string) => {
      if (state.watching) addMessage(text);
    });
    // 모니터 스레드 시작
    stopMonitor = await startListening();
  });

  onUnmounted(async () => {
    if (unlistenText) unlistenText();
    if (stopMonitor) await stopMonitor();
  });
}
```

- [ ] **Step 2: App.vue에서 감시 시작**

`src/App.vue`의 `<script setup>`에 `useClipboardWatch()` 호출을 추가(화면 토글 로직은 유지):
```vue
<script setup lang="ts">
import { ref } from "vue";
import MainView from "./views/MainView.vue";
import ResultView from "./views/ResultView.vue";
import { useClipboardWatch } from "./composables/useClipboardWatch";

// 앱 생애 동안 클립보드 감시 (1회)
useClipboardWatch();

// 현재 화면 상태 (main | result)
const screen = ref<"main" | "result">("main");
</script>
```
(template/style 블록은 기존 유지.)

- [ ] **Step 3: MainView 리스트 렌더 테스트 추가(실패 확인)**

`src/views/MainView.test.ts`에 아래 테스트를 추가(기존 테스트는 유지):
```ts
import { useClipboardMessages } from "../composables/useClipboardMessages";

// ... 기존 import/테스트 아래에 추가 ...

describe("MainView 클립보드 리스트", () => {
  const cb = useClipboardMessages();
  beforeEach(() => cb.clear());

  it("복사된 메시지를 리스트 항목으로 렌더한다", async () => {
    cb.addMessage("배포 완료했습니다");
    const wrapper = mount(MainView);
    const items = wrapper.findAll('[data-test="msg-item"]');
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain("배포 완료했습니다");
  });

  it("메시지를 클릭하면 선택된다", async () => {
    cb.addMessage("골라봐");
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="msg-item"]').trigger("click");
    expect(cb.selectedMessage.value?.text).toBe("골라봐");
  });
});
```
(파일 상단 import에 `beforeEach`가 없으면 `vitest`에서 추가 import.)

- [ ] **Step 4: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — MainView에 `data-test="msg-item"` 없음.

- [ ] **Step 5: MainView에 리스트/토글/비우기 UI 구현**

`src/views/MainView.vue`의 기존 msg-list placeholder 블록을 실제 리스트로 교체하고 script에 컴포저블을 연결한다. 나머지(유형/언어/요구사항/생성)는 유지:
```vue
<template>
  <section class="main-view">
    <h1>AI 공지 도우미</h1>

    <!-- 복사한 메시지 리스트 -->
    <div class="msg-header">
      <span>복사한 메시지</span>
      <label class="watch-toggle">
        <input type="checkbox" :checked="state.watching" data-test="watch-toggle"
          @change="onToggleWatch" />
        감시
      </label>
      <button class="clear-btn" data-test="clear-btn" @click="clear">전체 지우기</button>
    </div>
    <div class="msg-list" data-test="msg-list">
      <p v-if="state.messages.length === 0" class="placeholder">
        복사한 메시지가 여기에 표시됩니다.
      </p>
      <button
        v-for="m in state.messages"
        :key="m.id"
        type="button"
        class="msg-item"
        :class="{ selected: m.id === state.selectedId }"
        data-test="msg-item"
        @click="select(m.id)"
      >
        {{ m.preview }}
      </button>
    </div>

    <!-- 공지 유형 -->
    <label>공지 유형</label>
    <select v-model="type" data-test="notice-type">
      <option v-for="t in NOTICE_TYPES" :key="t" :value="t">{{ t }}</option>
    </select>

    <!-- 출력 언어 -->
    <label>언어</label>
    <select v-model="language" data-test="language">
      <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
    </select>

    <!-- 추가 요구사항 -->
    <label>추가 요구사항</label>
    <textarea
      v-model="requirement"
      data-test="requirement"
      placeholder="예) 존댓말, 3줄 이내, 영향 범위 강조"
    ></textarea>

    <!-- 공지 생성 -->
    <button data-test="generate-btn" @click="emitGenerate">공지 생성</button>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NOTICE_TYPES, LANGUAGES } from "../constants/notice";
import { useClipboardMessages } from "../composables/useClipboardMessages";

const emit = defineEmits<{ (e: "generate"): void }>();

// 공유 클립보드 상태
const { state, select, clear, setWatching } = useClipboardMessages();

const type = ref<string>(NOTICE_TYPES[0]);
const language = ref<string>(LANGUAGES[0].value);
const requirement = ref<string>("");

// 감시 토글 핸들러
const onToggleWatch = (e: Event): void => {
  setWatching((e.target as HTMLInputElement).checked);
};

// 화면 전환 (실제 생성은 후속 Plan)
const emitGenerate = (): void => {
  emit("generate");
};
</script>

<style scoped>
.main-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
.msg-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}
.watch-toggle {
  font-weight: 400;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.clear-btn {
  margin-left: auto;
  font-size: 12px;
}
.msg-list {
  min-height: 96px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.placeholder {
  color: #999;
  margin: 0;
}
.msg-item {
  text-align: left;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #f6f6f6;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.msg-item.selected {
  border-color: #3b82f6;
  background: #e8f0fe;
}
</style>
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: PASS (기존 + 신규 MainView 클립보드 테스트 2건).

- [ ] **Step 7: 프론트 타입/빌드 검증**

Run: `cd /Users/sjpark/Documents/project/ai && npm run build`
Expected: vue-tsc + vite build 성공(타입 에러 없음). `tauri-plugin-clipboard-api` 타입이 없으면 빌드가 실패하니, 실패 시 해당 패키지의 타입 제공 여부 확인 후 필요한 최소 조치(패키지가 d.ts 제공하는지 확인).

- [ ] **Step 8: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add -A
git commit -m "feat: 클립보드 감시 연결 및 메시지 리스트 UI

- useClipboardWatch: startListening/onTextUpdate로 복사 텍스트 적재(감시 on일 때)
- App에서 앱 생애 1회 감시 시작
- MainView에 복사한 메시지 리스트/선택/감시토글/전체지우기 UI"
```

---

## 완료 기준 (Plan 2)

- 앱 실행 중 텍스트를 복사하면 "복사한 메시지" 리스트에 자동으로 나타난다.
- 리스트 항목을 클릭하면 선택(하이라이트)된다.
- 감시 토글 off 시 새 복사가 적재되지 않고, 전체 지우기로 목록이 비워진다.
- 최근 20개까지만 유지된다.
- `npm test` 통과, `npm run build` 그린.

## 다음 Plan 예고 (범위 아님)

- Plan 3: llama-server 사이드카(JIT 다운로드) + 온디맨드 수명주기 + provider + `selectedMessage`+유형+언어+요구사항으로 AI 공지 생성.
- Plan 4: 결과 수정/복사/다시생성/AI수정 + 최근 기록 + 로그.
