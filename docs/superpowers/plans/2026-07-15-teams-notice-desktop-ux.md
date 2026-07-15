# AI 공지 도우미 — Plan 7: UX 개선 (프롬프트 기억 · 리스트 가독성 · 로딩 스피너)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 사용성 개선 3가지 — (1) 마지막으로 선택한 프롬프트를 재시작 후에도 기억, (2) 복사한 메시지 리스트를 2줄+시간 표시로 읽기 쉽게, (3) 생성 로딩에 스피너 + 진행바(indeterminate) 추가.

**Architecture:** `usePrompts`에 마지막 선택 id를 localStorage로 영구화. MainView가 setup 시 그 프롬프트를 복원하고, 선택/저장/삭제 시 갱신. 메시지 항목은 전체 텍스트 2줄 클램프 + 캡처 시각. ResultView 로딩 상태에 CSS 스피너와 움직이는 진행바.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, localStorage, CSS 애니메이션, Vitest(jsdom).

## Global Constraints

- Plan 1~6 위(main). usePrompts=`{id,title,content}` CRUD. useClipboardMessages 항목=`{id,text,preview,capturedAt,...}`(capturedAt은 Date). useGeneration status=idle|loading|success|error.
- 들여쓰기 스페이스, `<script setup lang="ts">`, data-test 훅 유지. 커밋 `feat|style` + 한글 + **Co-Authored-By 절대 금지**. 한글 주석.
- 백분율(%) 로딩은 로컬 모델이 전체 토큰을 모르므로 불가 → **indeterminate 진행바**로 대체(설계 결정).
- 범위: 위 3개 UX만. 스트리밍 생성은 범위 밖(후속 옵션).

---

### Task 1: usePrompts 마지막 선택 기억 (persist)

**Files:**
- Modify: `src/composables/usePrompts.ts`
- Modify: `src/composables/usePrompts.test.ts`

**Interfaces:**
- Produces (usePrompts에 추가):
  - `state.lastSelectedId: string` (초기값 = localStorage `"ai-notice:lastPromptId"` 또는 `""`)
  - `setLastSelected(id: string): void` — 상태 + localStorage 갱신
  - `deletePrompt`가 마지막 선택을 지우면 `lastSelectedId`도 비운다.

- [ ] **Step 1: 실패 테스트 추가**

`src/composables/usePrompts.test.ts`에 아래 테스트 추가(기존 유지):
```ts
  it("setLastSelected로 마지막 선택 id를 저장한다", () => {
    tpl.setLastSelected("p123");
    expect(tpl.state.lastSelectedId).toBe("p123");
    expect(localStorage.getItem("ai-notice:lastPromptId")).toBe("p123");
  });

  it("선택된 프롬프트를 삭제하면 lastSelectedId도 비워진다", () => {
    const saved = tpl.savePrompt("삭제대상", { type: "일반", language: "한국어", requirement: "" });
    tpl.setLastSelected((saved as { id: string }).id);
    tpl.deletePrompt((saved as { id: string }).id);
    expect(tpl.state.lastSelectedId).toBe("");
  });
```
(`beforeEach`에서 `localStorage.clear()` 뒤 `tpl.state.lastSelectedId`도 `""`로 초기화하도록 한 줄 추가: `tpl.setLastSelected("");` — 기존 beforeEach 끝에.)

> 주의: `usePrompts.ts`의 모델은 Plan 4에서 `{id,title,content}`로 바뀌었지만, 이 파일의 기존 테스트는 Plan 3 시절 시그니처(`savePrompt(name, {type,language,requirement})`)를 쓰지 않는다. **실제 `usePrompts.savePrompt(title, content)` 시그니처에 맞춰** 위 테스트의 `savePrompt` 호출을 `tpl.savePrompt("삭제대상", "내용")` 형태로 작성한다(현재 파일의 다른 테스트를 참고해 시그니처를 맞출 것).

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — `setLastSelected`/`lastSelectedId` 없음.

- [ ] **Step 3: 구현**

`src/composables/usePrompts.ts` 수정: 상단 상수/상태에 마지막 선택 추가, 함수 추가, deletePrompt에 정리 로직 추가. (기존 save/update/get 유지.)
```ts
const LAST_KEY = "ai-notice:lastPromptId";

// 앱 전역 단일 상태 (prompts + 마지막 선택 id)
const state = reactive({
  prompts: load() as Prompt[],
  lastSelectedId: localStorage.getItem(LAST_KEY) ?? "",
});
```
usePrompts() 내부에 추가:
```ts
  // 마지막 선택 프롬프트 id 저장
  const setLastSelected = (id: string): void => {
    state.lastSelectedId = id;
    localStorage.setItem(LAST_KEY, id);
  };
```
`deletePrompt`에 마지막 선택 정리 추가(splice/persist 후):
```ts
  const deletePrompt = (id: string): void => {
    const i = state.prompts.findIndex((x) => x.id === id);
    if (i >= 0) {
      state.prompts.splice(i, 1);
      persist();
      if (state.lastSelectedId === id) setLastSelected("");
    }
  };
```
return에 `setLastSelected` 추가.

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (기존 + usePrompts 신규 2건).

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/usePrompts.ts src/composables/usePrompts.test.ts
git commit -m "feat: 마지막 선택 프롬프트 기억

- usePrompts에 lastSelectedId 영구화(localStorage), setLastSelected 추가
- 선택 프롬프트 삭제 시 마지막 선택도 정리"
```

---

### Task 2: MainView — 마지막 프롬프트 복원 + 클립보드 리스트 가독성

**Files:**
- Modify: `src/views/MainView.vue`
- Modify: `src/views/MainView.test.ts`

**Interfaces:**
- Consumes: Task 1 (`state.lastSelectedId`, `setLastSelected`), 기존 usePrompts/useClipboardMessages.
- Produces: 앱 시작 시 마지막 프롬프트가 선택·로드됨. 메시지 항목이 2줄 + 시각으로 표시됨.

- [ ] **Step 1: 복원 테스트 추가(실패 확인)**

`src/views/MainView.test.ts`의 `describe("MainView 프롬프트", ...)`에 추가:
```ts
  it("마지막 선택 프롬프트가 있으면 시작 시 복원한다", () => {
    const saved = p.savePrompt("복원용", "복원 내용");
    p.setLastSelected((saved as { id: string }).id);
    const wrapper = mount(MainView);
    const title = wrapper.find('[data-test="prompt-title"]').element as HTMLInputElement;
    expect(title.value).toBe("복원용");
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — 복원 미구현.

- [ ] **Step 3: MainView 구현**

`src/views/MainView.vue` 수정:

script — usePrompts 구조분해에 `setLastSelected`, `state: promptState` 포함(이미 promptState 있으면 재사용), 그리고 setup 최상위에서 마지막 선택 복원. onSelectPrompt/onSavePrompt/onDeletePrompt에 setLastSelected 반영. 메시지 시각 헬퍼 추가.
```ts
// 프롬프트 상태 (마지막 선택 포함)
const { state: promptState, savePrompt, updatePrompt, deletePrompt, getPrompt, setLastSelected } = usePrompts();

// ... selectedPromptId/promptTitle/promptContent refs ...

// 시작 시 마지막 선택 프롬프트 복원 (onMounted 없이 setup 최상위)
if (promptState.lastSelectedId) {
  const lastP = getPrompt(promptState.lastSelectedId);
  if (lastP) {
    selectedPromptId.value = lastP.id;
    promptTitle.value = lastP.title;
    promptContent.value = lastP.content;
  }
}

// 프롬프트 선택 → 제목/내용 로드 + 마지막 선택 저장
const onSelectPrompt = (): void => {
  const pr = getPrompt(selectedPromptId.value);
  if (!pr) return;
  promptTitle.value = pr.title;
  promptContent.value = pr.content;
  setLastSelected(pr.id);
};

// 저장 → 새 프롬프트 + 마지막 선택 갱신
const onSavePrompt = (): void => {
  const saved = savePrompt(promptTitle.value, promptContent.value);
  if (saved) {
    selectedPromptId.value = saved.id;
    setLastSelected(saved.id);
  }
};

// 삭제 → 필드/선택 초기화 (usePrompts가 lastSelectedId도 정리)
const onDeletePrompt = (): void => {
  if (!selectedPromptId.value) return;
  deletePrompt(selectedPromptId.value);
  selectedPromptId.value = "";
  promptTitle.value = "";
  promptContent.value = "";
};

// 메시지 캡처 시각 (HH:MM)
const msgTime = (d: Date): string => {
  const dt = new Date(d);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};
```
(기존 onUpdatePrompt 등은 유지. `updatePrompt`는 그대로.)

template — 메시지 항목을 2줄 텍스트 + 시각으로:
```vue
      <button
        v-for="m in state.messages"
        :key="m.id"
        type="button"
        class="msg-item"
        :class="{ selected: m.id === state.selectedId }"
        data-test="msg-item"
        @click="select(m.id)"
      >
        <span class="msg-text">{{ m.text }}</span>
        <span class="msg-time">{{ msgTime(m.capturedAt) }}</span>
      </button>
```

scoped 스타일 — `.msg-item`을 2줄 클램프 레이아웃으로 교체하고 `.msg-list` max-height를 키움:
```css
.msg-list {
  min-height: 96px;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.msg-item {
  flex: none; /* 항목 많아도 찌그러지지 않게(스크롤로) */
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--item-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}
.msg-item:hover {
  border-color: var(--border);
}
.msg-item.selected {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 14%, var(--surface));
}
.msg-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}
.msg-time {
  align-self: flex-end;
  font-size: 11px;
  color: var(--muted);
}
```
(기존 `.msg-item`의 nowrap/ellipsis 규칙은 위로 교체.)

- [ ] **Step 4: 통과 확인 + 빌드**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
npm run build
```
Expected: 테스트 PASS(복원 테스트 포함, 기존 메시지 리스트 테스트도 `.text()`에 원문 포함되어 통과), 빌드 green.

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/views/MainView.vue src/views/MainView.test.ts
git commit -m "feat: 마지막 프롬프트 복원 및 메시지 리스트 가독성 개선

- 시작 시 마지막 선택 프롬프트 복원, 선택/저장/삭제 시 갱신
- 복사한 메시지 항목을 2줄 표시 + 캡처 시각, 리스트 높이 확대"
```

---

### Task 3: ResultView 로딩 스피너 + 진행바

**Files:**
- Modify: `src/views/ResultView.vue`

**Interfaces:**
- Consumes: useGeneration `state.status`. 로직/기존 액션 불변, 로딩 표시만 개선.

- [ ] **Step 1: 로딩 상태 마크업 교체**

`src/views/ResultView.vue`의 로딩 블록(`v-if="state.status === 'loading'"`)을 스피너 + 진행바로 교체(에러/결과 분기와 나머지 액션은 그대로):
```vue
    <!-- 로딩: 스피너 + 진행바(백분율 불가 → indeterminate) -->
    <div v-if="state.status === 'loading'" class="loading" data-test="status-loading">
      <div class="loading-head">
        <span class="spinner" aria-hidden="true"></span>
        <span>AI가 공지를 생성 중입니다…</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-label="생성 진행 중"></div>
    </div>
```

- [ ] **Step 2: 스타일 추가**

`src/views/ResultView.vue`의 `<style scoped>`에 추가(기존 유지):
```css
.loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.loading-head {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 14px;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex: none;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress-bar {
  position: relative;
  height: 4px;
  width: 100%;
  background: var(--item-bg);
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 40%;
  background: var(--primary);
  border-radius: 2px;
  animation: indeterminate 1.2s ease-in-out infinite;
}
@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
```

- [ ] **Step 3: 테스트 + 빌드 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
npm run build
```
Expected: 테스트 PASS(`status-loading` data-test 유지되어 기존/신규 영향 없음), 빌드 green.

- [ ] **Step 4: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/views/ResultView.vue
git commit -m "style: 생성 로딩에 스피너 및 진행바 추가

- 회전 스피너 + indeterminate 진행바로 생성 중 표시(로컬 모델은 백분율 불가)"
```

---

## 완료 기준 (Plan 7)

- 프롬프트를 선택하고 앱을 껐다 켜면 그 프롬프트가 자동으로 선택·로드된다.
- 복사한 메시지가 많아도 각 항목이 2줄 + 시각으로 읽기 쉽게 표시된다.
- 공지 생성 중에 회전 스피너와 움직이는 진행바가 보인다.
- `npm test` 통과, `npm run build` 그린.

## 다음 (선택, 범위 아님)

- 스트리밍 생성(토큰 실시간 표시) — 진짜 진행감. Rust 스트리밍 + Tauri 이벤트 필요.
- 배포용 llama-server 사이드카 번들.
