# AI 공지 도우미 — Plan 3: 템플릿 저장/선택 + UI 다듬기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 공지 유형·언어·추가 요구사항을 "이름 붙인 템플릿"으로 저장하고 선택해 폼을 채우는 기능(FR-010/011)을 추가하고, 앱 전반의 UI를 깔끔하게 다듬는다.

**Architecture:** 템플릿은 순수 로직 컴포저블 `useTemplates`(localStorage 영구 저장, 단위 테스트 가능)로 분리한다. MainView에 템플릿 선택 드롭다운 + 이름 입력 + 저장 버튼을 붙여 폼(type/language/requirement)과 연결한다. 마지막으로 App/MainView/ResultView의 스타일을 일관된 카드형 디자인으로 정리하고 라이트/다크 모드에 대응한다.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, localStorage(webview 영구 저장), Vitest(jsdom, localStorage 지원).

## Global Constraints

- Plan 1·2 위에서 작업. 클립보드/화면토글/공지유형·언어 상수 기존 유지.
- 들여쓰기 스페이스, `<script setup lang="ts">`, 파일 PascalCase(.vue)/camelCase(.ts), data-test 훅 유지.
- 커밋 컨벤션 `feat|fix|chore|docs|refactor|build` + 한글 + **Co-Authored-By 절대 금지**. 한글 주석.
- 템플릿 모델: `NoticeTemplate = { id: string; name: string; type: string; language: string; requirement: string }`. localStorage 키 `"ai-notice:templates"`에 JSON 배열로 저장.
- 이 Plan 범위: 템플릿 저장/선택/삭제 + UI 다듬기. AI 생성·결과 액션·최근 기록은 범위 밖(후속).
- UI 다듬기 원칙: 전역 SCSS 수정 없음(이 프로젝트엔 전역 SCSS가 없으니 각 .vue의 `<style scoped>`에만 작성). 컴포넌트별 로컬 스타일.

---

### Task 1: useTemplates 컴포저블 (localStorage 영구 저장, TDD)

**Files:**
- Create: `src/composables/useTemplates.ts`
- Test: `src/composables/useTemplates.test.ts`

**Interfaces:**
- Produces: `useTemplates()` →
  - `state.templates: NoticeTemplate[]`
  - `NoticeTemplate = { id: string; name: string; type: string; language: string; requirement: string }`
  - `saveTemplate(name: string, preset: { type: string; language: string; requirement: string }): NoticeTemplate | null` (빈 이름이면 null, 저장 안 함)
  - `deleteTemplate(id: string): void`
  - `getTemplate(id: string): NoticeTemplate | undefined`
  - 모듈 수준 단일 상태. 변경 시 localStorage에 즉시 persist.

- [ ] **Step 1: 실패 테스트 작성**

Create `src/composables/useTemplates.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useTemplates } from "./useTemplates";

describe("useTemplates", () => {
  const tpl = useTemplates();

  beforeEach(() => {
    // 상태·저장소 초기화
    tpl.state.templates.splice(0);
    localStorage.clear();
  });

  it("템플릿을 저장하면 목록에 추가되고 localStorage에 남는다", () => {
    tpl.saveTemplate("배포 기본", { type: "배포", language: "한국어", requirement: "존댓말, 3줄" });
    expect(tpl.state.templates).toHaveLength(1);
    expect(tpl.state.templates[0].name).toBe("배포 기본");
    const raw = localStorage.getItem("ai-notice:templates");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });

  it("빈 이름은 저장하지 않고 null을 반환한다", () => {
    const r = tpl.saveTemplate("   ", { type: "일반", language: "한국어", requirement: "" });
    expect(r).toBeNull();
    expect(tpl.state.templates).toHaveLength(0);
  });

  it("저장한 템플릿을 id로 조회한다", () => {
    const saved = tpl.saveTemplate("장애", { type: "장애", language: "English", requirement: "short" });
    expect(saved).not.toBeNull();
    expect(tpl.getTemplate((saved as { id: string }).id)?.type).toBe("장애");
  });

  it("템플릿을 삭제하면 목록과 저장소에서 사라진다", () => {
    const saved = tpl.saveTemplate("삭제대상", { type: "일반", language: "한국어", requirement: "" });
    tpl.deleteTemplate((saved as { id: string }).id);
    expect(tpl.state.templates).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("ai-notice:templates") as string)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — `./useTemplates` 없음.

- [ ] **Step 3: 컴포저블 구현**

Create `src/composables/useTemplates.ts`:
```ts
import { reactive } from "vue";

// 공지 템플릿(이름 붙인 프리셋)
export interface NoticeTemplate {
  id: string;
  name: string;
  type: string;
  language: string;
  requirement: string;
}

const STORAGE_KEY = "ai-notice:templates";

// localStorage에서 초기 로드 (손상 시 빈 배열)
const load = (): NoticeTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NoticeTemplate[]) : [];
  } catch {
    return [];
  }
};

// 앱 전역 단일 상태
const state = reactive({ templates: load() as NoticeTemplate[] });

// 현재 상태를 localStorage에 저장
const persist = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.templates));
};

let seq = 0;
// 간단한 고유 id (런타임 전용)
const genId = (): string => `t${Date.now()}_${++seq}`;

export function useTemplates() {
  // 현재 프리셋을 이름 붙여 저장 (빈 이름은 무시)
  const saveTemplate = (
    name: string,
    preset: { type: string; language: string; requirement: string },
  ): NoticeTemplate | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const tpl: NoticeTemplate = {
      id: genId(),
      name: trimmed,
      type: preset.type,
      language: preset.language,
      requirement: preset.requirement,
    };
    state.templates.push(tpl);
    persist();
    return tpl;
  };

  // 템플릿 삭제
  const deleteTemplate = (id: string): void => {
    const i = state.templates.findIndex((t) => t.id === id);
    if (i >= 0) {
      state.templates.splice(i, 1);
      persist();
    }
  };

  // id로 조회
  const getTemplate = (id: string): NoticeTemplate | undefined =>
    state.templates.find((t) => t.id === id);

  return { state, saveTemplate, deleteTemplate, getTemplate };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: PASS (기존 14건 + useTemplates 4건).

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/useTemplates.ts src/composables/useTemplates.test.ts
git commit -m "feat: 공지 템플릿 저장 컴포저블 추가

- useTemplates: 이름 붙인 프리셋(유형/언어/요구사항) 저장·조회·삭제, localStorage 영구화
- 단위 테스트 4건"
```

---

### Task 2: MainView 템플릿 선택/저장 UI 연결

**Files:**
- Modify: `src/views/MainView.vue`
- Modify: `src/views/MainView.test.ts` (템플릿 저장/선택 테스트 추가)

**Interfaces:**
- Consumes: `useTemplates`(Task 1).
- Produces: MainView에서 템플릿 선택 시 유형/언어/요구사항 폼이 채워지고, 이름 입력 후 저장 시 새 템플릿이 추가됨.

- [ ] **Step 1: 템플릿 UI 테스트 추가(실패 확인)**

`src/views/MainView.test.ts`에 아래 describe 블록 추가(기존 유지):
```ts
import { useTemplates } from "../composables/useTemplates";

describe("MainView 템플릿", () => {
  const tpl = useTemplates();
  beforeEach(() => {
    tpl.state.templates.splice(0);
    localStorage.clear();
  });

  it("이름 입력 후 저장하면 템플릿이 추가된다", async () => {
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="tpl-name"]').setValue("내 배포 템플릿");
    await wrapper.find('[data-test="tpl-save"]').trigger("click");
    expect(tpl.state.templates).toHaveLength(1);
    expect(tpl.state.templates[0].name).toBe("내 배포 템플릿");
  });

  it("저장된 템플릿을 선택하면 유형이 폼에 반영된다", async () => {
    tpl.saveTemplate("장애템플릿", { type: "장애", language: "한국어", requirement: "영향범위 강조" });
    const wrapper = mount(MainView);
    const id = tpl.state.templates[0].id;
    await wrapper.find('[data-test="tpl-select"]').setValue(id);
    const typeSelect = wrapper.find('[data-test="notice-type"]').element as HTMLSelectElement;
    expect(typeSelect.value).toBe("장애");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `data-test="tpl-name"`/`tpl-save`/`tpl-select` 없음.

- [ ] **Step 3: MainView에 템플릿 UI 추가**

`src/views/MainView.vue`에서 "공지 유형" 위(또는 폼 상단)에 템플릿 영역을 추가하고 script에 `useTemplates`를 연결한다. 기존 요소(메시지 리스트, 유형/언어/요구사항/생성)는 유지. 아래는 script와 템플릿 template 조각(기존 코드에 병합):

script `<script setup lang="ts">`에 추가:
```ts
import { useTemplates } from "../composables/useTemplates";

const { state: tplState, saveTemplate, getTemplate } = useTemplates();

// 템플릿 저장용 이름 입력
const templateName = ref<string>("");
// 선택된 템플릿 id
const selectedTemplateId = ref<string>("");

// 현재 폼을 템플릿으로 저장
const onSaveTemplate = (): void => {
  const saved = saveTemplate(templateName.value, {
    type: type.value,
    language: language.value,
    requirement: requirement.value,
  });
  if (saved) templateName.value = "";
};

// 템플릿 선택 시 폼에 적용
const onSelectTemplate = (): void => {
  const t = getTemplate(selectedTemplateId.value);
  if (!t) return;
  type.value = t.type;
  language.value = t.language;
  requirement.value = t.requirement;
};
```

template의 "공지 유형" `<label>` 바로 위에 삽입:
```vue
    <!-- 템플릿 선택/저장 -->
    <label>템플릿</label>
    <div class="tpl-row">
      <select v-model="selectedTemplateId" data-test="tpl-select" @change="onSelectTemplate">
        <option value="">템플릿 선택…</option>
        <option v-for="t in tplState.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <input
        v-model="templateName"
        data-test="tpl-name"
        class="tpl-name"
        placeholder="새 템플릿 이름"
      />
      <button data-test="tpl-save" type="button" @click="onSaveTemplate">저장</button>
    </div>
```

(scoped 스타일에 `.tpl-row { display: flex; gap: 8px; } .tpl-name { flex: 1; }` 정도 추가. 상세 스타일은 Task 3에서 통합.)

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (기존 + MainView 템플릿 2건).

- [ ] **Step 5: 빌드 검증 + 커밋**

Run: `npm run build` → green.
```bash
cd /Users/sjpark/Documents/project/ai
git add src/views/MainView.vue src/views/MainView.test.ts
git commit -m "feat: 공지 템플릿 선택/저장 UI 연결

- MainView에 템플릿 드롭다운·이름입력·저장 버튼 추가
- 선택 시 유형/언어/요구사항 폼 자동 채움, 저장 시 현재 폼을 템플릿으로 보관"
```

---

### Task 3: UI 다듬기 (App/MainView/ResultView 스타일 정리 + 다크 대응)

**Files:**
- Modify: `src/App.vue` (전역 베이스 스타일: 배경/폰트/컬러 변수, 라이트/다크)
- Modify: `src/views/MainView.vue` (`<style scoped>` 정리)
- Modify: `src/views/ResultView.vue` (`<style scoped>` 정리)

**Interfaces:**
- Consumes: 없음(스타일만). 기능/마크업 구조(data-test, v-model, 이벤트)는 변경하지 않는다 — 클래스·스타일만 손본다.

- [ ] **Step 1: App.vue 베이스 스타일 + 컬러 변수(라이트/다크)**

`src/App.vue`의 `<style>`(비-scoped 전역 베이스)를 아래로 교체/보강. template/script는 변경하지 않는다:
```vue
<style>
:root {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --text: #1f2430;
  --muted: #8a90a0;
  --border: #e3e6ec;
  --item-bg: #f2f4f7;
  --primary: #3b82f6;
  --primary-text: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
}
/* 다크 팔레트 (믹스인) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1c1f26;
    --surface: #252a33;
    --text: #e7e9ee;
    --muted: #9aa1b1;
    --border: #363c47;
    --item-bg: #2d323c;
    --primary: #4c8dff;
    --primary-text: #ffffff;
  }
}
/* 수동 토글이 OS 설정을 이긴다 (Task 4의 data-theme) */
:root[data-theme="dark"] {
  --bg: #1c1f26;
  --surface: #252a33;
  --text: #e7e9ee;
  --muted: #9aa1b1;
  --border: #363c47;
  --item-bg: #2d323c;
  --primary: #4c8dff;
  --primary-text: #ffffff;
}
:root[data-theme="light"] {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --text: #1f2430;
  --muted: #8a90a0;
  --border: #e3e6ec;
  --item-bg: #f2f4f7;
  --primary: #3b82f6;
  --primary-text: #ffffff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
}
</style>
```

- [ ] **Step 2: MainView `<style scoped>` 정리**

`src/views/MainView.vue`의 `<style scoped>`를 아래로 교체(마크업·script 불변). 컬러 변수를 사용하고, 리스트/폼/버튼을 카드형으로 정리:
```css
.main-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  max-width: 720px;
  margin: 0 auto;
}
h1 {
  font-size: 22px;
  margin: 0 0 4px;
}
label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
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
  color: var(--muted);
}
.clear-btn {
  margin-left: auto;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
.msg-list {
  min-height: 96px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.placeholder {
  color: var(--muted);
  margin: 8px 4px;
  font-size: 13px;
}
.msg-item {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--item-bg);
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}
.msg-item:hover {
  border-color: var(--border);
}
.msg-item.selected {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 14%, var(--surface));
}
.tpl-row {
  display: flex;
  gap: 8px;
}
.tpl-name {
  flex: 1;
}
select,
input,
textarea {
  font: inherit;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
textarea {
  min-height: 64px;
  resize: vertical;
}
button[data-test="generate-btn"] {
  margin-top: 4px;
  padding: 11px;
  border: none;
  border-radius: 10px;
  background: var(--primary);
  color: var(--primary-text);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
button[data-test="generate-btn"]:hover {
  filter: brightness(1.05);
}
button[data-test="tpl-save"] {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}
</style>
```

- [ ] **Step 3: ResultView `<style scoped>` 정리**

`src/views/ResultView.vue`의 `<style scoped>`를 아래로 교체(마크업·script 불변):
```css
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
.actions {
  display: flex;
  gap: 8px;
}
.actions button {
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.actions button:hover {
  border-color: var(--primary);
}
</style>
```

- [ ] **Step 4: 테스트·빌드 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
npm run build
```
Expected: 테스트 전부 PASS(스타일만 바꿔 기존 테스트 영향 없음), 빌드 green.

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/App.vue src/views/MainView.vue src/views/ResultView.vue
git commit -m "style: 앱 UI 다듬기 및 라이트/다크 대응

- 컬러 변수 기반 카드형 레이아웃, 여백·타이포 정리
- 메시지 리스트/폼/버튼 스타일 정리, prefers-color-scheme 다크 대응
- 마크업·기능 변경 없이 스타일만 정리"
```

---

### Task 4: 라이트/다크 수동 토글 (useTheme 컴포저블 + 토글 버튼)

**Files:**
- Create: `src/composables/useTheme.ts`
- Test: `src/composables/useTheme.test.ts`
- Modify: `src/App.vue` (초기 테마 적용 + 우상단 토글 버튼)

**Interfaces:**
- Consumes: 없음(순수 로직 + DOM).
- Produces: `useTheme()` →
  - `theme: Ref<"light" | "dark">`
  - `setTheme(t): void`, `toggleTheme(): void`, `initTheme(): void`
  - `initTheme`은 저장값(없으면 OS 선호) 기준으로 `document.documentElement`에 `data-theme`를 적용. 변경 시 localStorage 키 `"ai-notice:theme"`에 저장.

- [ ] **Step 1: 실패 테스트 작성**

Create `src/composables/useTheme.test.ts`:
```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — `./useTheme` 없음.

- [ ] **Step 3: 컴포저블 구현**

Create `src/composables/useTheme.ts`:
```ts
import { ref } from "vue";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ai-notice:theme";

// 저장값 우선, 없으면 OS 선호(matchMedia 없으면 light)
const detectInitial = (): Theme => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

// 앱 전역 단일 테마 상태
const theme = ref<Theme>("light");

// 루트 엘리먼트에 data-theme 적용
const apply = (t: Theme): void => {
  document.documentElement.setAttribute("data-theme", t);
};

export function useTheme() {
  // 테마 지정(상태+저장+DOM)
  const setTheme = (t: Theme): void => {
    theme.value = t;
    localStorage.setItem(STORAGE_KEY, t);
    apply(t);
  };

  // 라이트↔다크 전환
  const toggleTheme = (): void => {
    setTheme(theme.value === "dark" ? "light" : "dark");
  };

  // 초기 적용(App 시작 시 1회)
  const initTheme = (): void => {
    theme.value = detectInitial();
    apply(theme.value);
  };

  return { theme, setTheme, toggleTheme, initTheme };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (기존 + useTheme 3건).

- [ ] **Step 5: App.vue에 초기화 + 토글 버튼**

`src/App.vue`에 테마 초기화와 우상단 토글 버튼을 추가한다. 기존 화면 토글(`screen`)과 클립보드 감시(`useClipboardWatch`)는 유지:
```vue
<template>
  <button class="theme-toggle" type="button" data-test="theme-toggle" @click="toggleTheme">
    {{ theme === "dark" ? "☀️" : "🌙" }}
  </button>
  <MainView v-if="screen === 'main'" @generate="screen = 'result'" />
  <ResultView v-else @back="screen = 'main'" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import MainView from "./views/MainView.vue";
import ResultView from "./views/ResultView.vue";
import { useClipboardWatch } from "./composables/useClipboardWatch";
import { useTheme } from "./composables/useTheme";

// 앱 생애 동안 클립보드 감시 (1회)
useClipboardWatch();

// 테마 초기화 + 토글
const { theme, toggleTheme, initTheme } = useTheme();
initTheme();

// 현재 화면 상태 (main | result)
const screen = ref<"main" | "result">("main");
</script>

<style>
/* 기존 :root 변수/다크 팔레트/body 스타일 유지하고 아래 토글 버튼 스타일 추가 */
.theme-toggle {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 10;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  width: 34px;
  height: 34px;
  font-size: 15px;
  cursor: pointer;
}
</style>
```
(Step 1(Task 3)에서 넣은 `:root` 변수·다크 팔레트·body 스타일 블록은 그대로 두고, 위 `.theme-toggle` 규칙만 같은 `<style>`에 추가.)

- [ ] **Step 6: 테스트·빌드 검증 + 커밋**

Run: `npm test` (전부 PASS), `npm run build` (green).
```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/useTheme.ts src/composables/useTheme.test.ts src/App.vue
git commit -m "feat: 라이트/다크 수동 토글 추가

- useTheme: data-theme 적용 + localStorage 저장, OS 선호 기본값
- App 우상단 토글 버튼(🌙/☀️)으로 라이트↔다크 전환"
```

---

## 완료 기준 (Plan 3)

- 이름을 입력하고 저장하면 템플릿이 추가되고, 앱을 껐다 켜도 유지된다(localStorage).
- 템플릿을 선택하면 공지 유형/언어/추가 요구사항 폼이 그 값으로 채워진다.
- 앱 UI가 일관된 카드형으로 정리되고, 라이트/다크 모드에서 모두 읽기 좋다. 메시지 리스트가 항목이 많아도 깔끔하게 스크롤된다.
- **우상단 토글 버튼으로 라이트/다크를 즉시 전환**할 수 있고, 선택이 재시작 후에도 유지된다.
- `npm test` 통과, `npm run build` 그린.

## 다음 Plan 예고 (범위 아님)

- Plan 4: llama-server 사이드카(JIT 다운로드) + 온디맨드 수명주기 + provider + 선택 메시지/유형/언어/요구사항/템플릿으로 AI 공지 생성.
- Plan 5: 결과 수정/복사/다시생성/AI수정 + 최근 기록 20건 + 로그.
