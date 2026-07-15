# AI 공지 도우미 — Plan 4: 프롬프트 재정의 (공지유형 제거 + 프롬프트 저장/선택/수정/삭제)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** "템플릿"을 사용자 의도대로 **프롬프트(제목+내용)** 로 재정의한다. 공지 유형 드롭다운을 제거(AI가 유형을 알아서 판단)하고, 프롬프트를 제목·내용으로 저장/선택/**수정**/삭제할 수 있게 한다. 프롬프트 내용이 AI 지시문 역할을 한다(기존 "추가 요구사항" 대체).

**Architecture:** `usePrompts` 컴포저블(localStorage 영구 저장, `{id,title,content}`)이 프롬프트 CRUD를 담당한다. MainView에서 공지 유형 UI를 제거하고, 프롬프트 선택 드롭다운 + 제목/내용 편집 + 저장/수정/삭제 버튼을 붙인다. 기존 useTemplates(잘못 만든 모델)는 제거한다.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, localStorage, Vitest(jsdom).

## Global Constraints

- Plan 1~3 위에서 작업(main). 클립보드 리스트/언어/화면토글/테마토글 유지.
- **공지 유형(NOTICE_TYPES) UI는 제거**한다(상수 파일 `constants/notice.ts`의 NOTICE_TYPES 자체는 향후 AI 유형 추론 힌트로 남겨두되, MainView에서 import·사용하지 않는다). `LANGUAGES`/언어 select는 유지.
- 프롬프트 모델: `Prompt = { id: string; title: string; content: string }`. localStorage 키 `"ai-notice:prompts"`.
- 기존 "추가 요구사항(requirement)" 필드는 제거하고, **프롬프트 내용(content) textarea가 그 역할**을 한다.
- 들여쓰기 스페이스, `<script setup lang="ts">`, data-test 훅 유지, 한글 주석. 커밋 `feat|fix|refactor` + 한글 + **Co-Authored-By 절대 금지**.
- 이 Plan 범위: 프롬프트 CRUD + 공지유형 제거. AI 생성은 범위 밖(다음 Plan). 프롬프트 내용·선택 메시지·언어는 다음 Plan(생성)이 읽어간다.

---

### Task 1: usePrompts 컴포저블 (localStorage, TDD)

**Files:**
- Create: `src/composables/usePrompts.ts`
- Test: `src/composables/usePrompts.test.ts`

**Interfaces:**
- Produces: `usePrompts()` →
  - `state.prompts: Prompt[]`, `Prompt = { id: string; title: string; content: string }`
  - `savePrompt(title: string, content: string): Prompt | null` (빈 제목 → null)
  - `updatePrompt(id: string, title: string, content: string): void` (없는 id·빈 제목 → 무시)
  - `deletePrompt(id: string): void`
  - `getPrompt(id: string): Prompt | undefined`
  - 모듈 수준 단일 상태, 변경 시 localStorage persist.

- [ ] **Step 1: 실패 테스트 작성**

Create `src/composables/usePrompts.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { usePrompts } from "./usePrompts";

describe("usePrompts", () => {
  const p = usePrompts();
  beforeEach(() => {
    p.state.prompts.splice(0);
    localStorage.clear();
  });

  it("제목+내용을 저장하면 목록·저장소에 추가된다", () => {
    p.savePrompt("배포 공지", "배포 메시지를 존댓말 3줄로 요약해줘");
    expect(p.state.prompts).toHaveLength(1);
    expect(p.state.prompts[0].title).toBe("배포 공지");
    expect(p.state.prompts[0].content).toBe("배포 메시지를 존댓말 3줄로 요약해줘");
    expect(JSON.parse(localStorage.getItem("ai-notice:prompts") as string)).toHaveLength(1);
  });

  it("빈 제목은 저장하지 않고 null을 반환한다", () => {
    expect(p.savePrompt("   ", "내용")).toBeNull();
    expect(p.state.prompts).toHaveLength(0);
  });

  it("updatePrompt로 제목/내용을 수정한다", () => {
    const saved = p.savePrompt("원본", "원본내용");
    p.updatePrompt((saved as { id: string }).id, "수정됨", "새 내용");
    const got = p.getPrompt((saved as { id: string }).id);
    expect(got?.title).toBe("수정됨");
    expect(got?.content).toBe("새 내용");
    expect(JSON.parse(localStorage.getItem("ai-notice:prompts") as string)[0].title).toBe("수정됨");
  });

  it("빈 제목으로 수정하면 무시한다", () => {
    const saved = p.savePrompt("원본", "원본내용");
    p.updatePrompt((saved as { id: string }).id, "  ", "x");
    expect(p.getPrompt((saved as { id: string }).id)?.title).toBe("원본");
  });

  it("deletePrompt로 삭제한다", () => {
    const saved = p.savePrompt("삭제대상", "x");
    p.deletePrompt((saved as { id: string }).id);
    expect(p.state.prompts).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("ai-notice:prompts") as string)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — `./usePrompts` 없음.

- [ ] **Step 3: 컴포저블 구현**

Create `src/composables/usePrompts.ts`:
```ts
import { reactive } from "vue";

// AI 지시 프롬프트(제목 + 내용)
export interface Prompt {
  id: string;
  title: string;
  content: string;
}

const STORAGE_KEY = "ai-notice:prompts";

// localStorage에서 초기 로드 (손상 시 빈 배열)
const load = (): Prompt[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Prompt[]) : [];
  } catch {
    return [];
  }
};

// 앱 전역 단일 상태
const state = reactive({ prompts: load() as Prompt[] });

// 현재 상태를 localStorage에 저장
const persist = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prompts));
};

let seq = 0;
const genId = (): string => `p${Date.now()}_${++seq}`;

export function usePrompts() {
  // 새 프롬프트 저장 (빈 제목은 무시)
  const savePrompt = (title: string, content: string): Prompt | null => {
    const t = title.trim();
    if (!t) return null;
    const p: Prompt = { id: genId(), title: t, content };
    state.prompts.push(p);
    persist();
    return p;
  };

  // 기존 프롬프트 수정 (없는 id·빈 제목은 무시)
  const updatePrompt = (id: string, title: string, content: string): void => {
    const p = state.prompts.find((x) => x.id === id);
    if (!p) return;
    const t = title.trim();
    if (!t) return;
    p.title = t;
    p.content = content;
    persist();
  };

  // 삭제
  const deletePrompt = (id: string): void => {
    const i = state.prompts.findIndex((x) => x.id === id);
    if (i >= 0) {
      state.prompts.splice(i, 1);
      persist();
    }
  };

  // id로 조회
  const getPrompt = (id: string): Prompt | undefined =>
    state.prompts.find((x) => x.id === id);

  return { state, savePrompt, updatePrompt, deletePrompt, getPrompt };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: PASS (기존 23건 + usePrompts 5건 = 28. useTemplates 테스트는 아직 존재 — Task 2에서 제거).

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/usePrompts.ts src/composables/usePrompts.test.ts
git commit -m "feat: 프롬프트 저장 컴포저블 추가

- usePrompts: 제목+내용 프롬프트 저장/수정/삭제/조회, localStorage 영구화
- 단위 테스트 5건"
```

---

### Task 2: MainView 재작업 (공지유형 제거 + 프롬프트 UI) 및 useTemplates 제거

**Files:**
- Modify: `src/views/MainView.vue`
- Modify: `src/views/MainView.test.ts`
- Delete: `src/composables/useTemplates.ts`, `src/composables/useTemplates.test.ts`

**Interfaces:**
- Consumes: `usePrompts`(Task 1), `useClipboardMessages`, `LANGUAGES`.
- Produces: MainView에서 공지 유형 없이 언어 + 프롬프트(선택/제목/내용/저장/수정/삭제) + 생성 버튼. `promptContent`(지시문)·`language`·선택 메시지가 다음 Plan(생성)의 입력.

- [ ] **Step 1: MainView 테스트 갱신(실패 확인)**

`src/views/MainView.test.ts`를 아래로 교체(클립보드 리스트 테스트는 유지, 공지유형/템플릿 테스트는 프롬프트 테스트로 교체):
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import MainView from "./MainView.vue";
import { useClipboardMessages } from "../composables/useClipboardMessages";
import { usePrompts } from "../composables/usePrompts";

describe("MainView", () => {
  it("공지 생성 버튼이 있다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="generate-btn"]').exists()).toBe(true);
  });

  it("공지 유형 드롭다운은 없다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="notice-type"]').exists()).toBe(false);
  });

  it("언어 드롭다운이 있다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="language"]').exists()).toBe(true);
  });
});

describe("MainView 클립보드 리스트", () => {
  const cb = useClipboardMessages();
  beforeEach(() => cb.clear());

  it("복사된 메시지를 리스트 항목으로 렌더한다", () => {
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

describe("MainView 프롬프트", () => {
  const p = usePrompts();
  beforeEach(() => {
    p.state.prompts.splice(0);
    localStorage.clear();
  });

  it("제목+내용을 저장하면 프롬프트가 추가된다", async () => {
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="prompt-title"]').setValue("내 프롬프트");
    await wrapper.find('[data-test="prompt-content"]').setValue("존댓말로 3줄");
    await wrapper.find('[data-test="prompt-save"]').trigger("click");
    expect(p.state.prompts).toHaveLength(1);
    expect(p.state.prompts[0].title).toBe("내 프롬프트");
    expect(p.state.prompts[0].content).toBe("존댓말로 3줄");
  });

  it("프롬프트를 선택하면 제목/내용이 로드된다", async () => {
    p.savePrompt("장애", "영향범위 강조");
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="prompt-select"]').setValue(p.state.prompts[0].id);
    const title = wrapper.find('[data-test="prompt-title"]').element as HTMLInputElement;
    const content = wrapper.find('[data-test="prompt-content"]').element as HTMLTextAreaElement;
    expect(title.value).toBe("장애");
    expect(content.value).toBe("영향범위 강조");
  });

  it("선택 후 수정하면 프롬프트가 갱신된다", async () => {
    p.savePrompt("원본", "원본내용");
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="prompt-select"]').setValue(p.state.prompts[0].id);
    await wrapper.find('[data-test="prompt-title"]').setValue("수정본");
    await wrapper.find('[data-test="prompt-update"]').trigger("click");
    expect(p.state.prompts[0].title).toBe("수정본");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — MainView에 prompt UI 없음/공지유형 아직 있음, 그리고 useTemplates 관련은 아직 남아있음.

- [ ] **Step 3: MainView 재작성**

Replace `src/views/MainView.vue` 전체:
```vue
<template>
  <section class="main-view">
    <h1>AI 공지 도우미</h1>

    <!-- 복사한 메시지 리스트 -->
    <div class="msg-header">
      <span>복사한 메시지</span>
      <label class="watch-toggle">
        <input type="checkbox" :checked="state.watching" data-test="watch-toggle" @change="onToggleWatch" />
        감시
      </label>
      <button class="clear-btn" data-test="clear-btn" @click="clear">전체 지우기</button>
    </div>
    <div class="msg-list" data-test="msg-list">
      <p v-if="state.messages.length === 0" class="placeholder">복사한 메시지가 여기에 표시됩니다.</p>
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

    <!-- 프롬프트 선택/편집 -->
    <label>프롬프트</label>
    <div class="prompt-head">
      <select v-model="selectedPromptId" data-test="prompt-select" @change="onSelectPrompt">
        <option value="">프롬프트 선택…</option>
        <option v-for="pr in promptState.prompts" :key="pr.id" :value="pr.id">{{ pr.title }}</option>
      </select>
      <button data-test="prompt-save" type="button" @click="onSavePrompt">저장</button>
      <button data-test="prompt-update" type="button" :disabled="!selectedPromptId" @click="onUpdatePrompt">수정</button>
      <button data-test="prompt-delete" type="button" :disabled="!selectedPromptId" @click="onDeletePrompt">삭제</button>
    </div>
    <input v-model="promptTitle" data-test="prompt-title" placeholder="프롬프트 제목" />
    <textarea
      v-model="promptContent"
      data-test="prompt-content"
      class="prompt-content"
      placeholder="AI에게 줄 지시 (예: 존댓말로 3줄 이내, 영향 범위 강조, 담당자 마지막)"
    ></textarea>

    <!-- 출력 언어 -->
    <label>언어</label>
    <select v-model="language" data-test="language">
      <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
    </select>

    <!-- 공지 생성 -->
    <button data-test="generate-btn" class="generate-btn" @click="emitGenerate">공지 생성</button>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { LANGUAGES } from "../constants/notice";
import { useClipboardMessages } from "../composables/useClipboardMessages";
import { usePrompts } from "../composables/usePrompts";

const emit = defineEmits<{ (e: "generate"): void }>();

// 공유 클립보드 상태
const { state, select, clear, setWatching } = useClipboardMessages();

// 프롬프트 상태
const { state: promptState, savePrompt, updatePrompt, deletePrompt, getPrompt } = usePrompts();

// 출력 언어
const language = ref<string>(LANGUAGES[0].value);

// 프롬프트 편집 상태
const selectedPromptId = ref<string>("");
const promptTitle = ref<string>("");
const promptContent = ref<string>("");

// 감시 토글
const onToggleWatch = (e: Event): void => {
  setWatching((e.target as HTMLInputElement).checked);
};

// 프롬프트 선택 → 제목/내용 로드
const onSelectPrompt = (): void => {
  const p = getPrompt(selectedPromptId.value);
  if (!p) return;
  promptTitle.value = p.title;
  promptContent.value = p.content;
};

// 현재 편집 내용을 새 프롬프트로 저장
const onSavePrompt = (): void => {
  const saved = savePrompt(promptTitle.value, promptContent.value);
  if (saved) selectedPromptId.value = saved.id;
};

// 선택된 프롬프트 수정
const onUpdatePrompt = (): void => {
  if (!selectedPromptId.value) return;
  updatePrompt(selectedPromptId.value, promptTitle.value, promptContent.value);
};

// 선택된 프롬프트 삭제
const onDeletePrompt = (): void => {
  if (!selectedPromptId.value) return;
  deletePrompt(selectedPromptId.value);
  selectedPromptId.value = "";
  promptTitle.value = "";
  promptContent.value = "";
};

// 화면 전환 (실제 생성은 다음 Plan)
const emitGenerate = (): void => {
  emit("generate");
};
</script>

<style scoped>
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
.prompt-head {
  display: flex;
  gap: 8px;
}
.prompt-head select {
  flex: 1;
}
.prompt-content {
  min-height: 80px;
  resize: vertical;
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
.prompt-head button {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.prompt-head button:disabled {
  opacity: 0.45;
  cursor: default;
}
.generate-btn {
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
.generate-btn:hover {
  filter: brightness(1.05);
}
</style>
```

- [ ] **Step 4: useTemplates 제거**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
git rm src/composables/useTemplates.ts src/composables/useTemplates.test.ts
```

- [ ] **Step 5: 통과 확인 + 빌드**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
npm run build
```
Expected: 테스트 PASS(공지유형/템플릿 테스트 제거·프롬프트 테스트 추가 반영), 빌드 green. useTemplates import 잔재 없어야 함(있으면 빌드 실패 → 확인).

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add -A
git commit -m "refactor: 공지 유형 제거 및 템플릿을 프롬프트로 재정의

- MainView에서 공지 유형 드롭다운 제거(AI가 유형 판단), 추가 요구사항을 프롬프트 내용으로 통합
- 프롬프트 선택/제목·내용 편집/저장/수정/삭제 UI 연결(usePrompts)
- 잘못 만든 useTemplates 컴포저블·테스트 제거"
```

---

## 완료 기준 (Plan 4)

- 공지 유형 드롭다운이 사라지고, 언어 + 프롬프트(제목/내용) + 생성만 남는다.
- 프롬프트 제목·내용을 적어 저장하면 셀렉트박스에 제목으로 나타나고, 앱을 껐다 켜도 유지된다.
- 셀렉트박스에서 프롬프트를 고르면 제목/내용이 편집 필드에 로드되고, **수정/삭제**가 동작한다.
- `npm test` 통과, `npm run build` 그린.

## 다음 Plan 예고 (범위 아님)

- Plan 5: llama-server 사이드카(JIT 다운로드) + 온디맨드 수명주기 + provider + (선택 메시지 + 프롬프트 내용 + 언어)로 AI 공지 생성(유형은 AI가 판단).
- Plan 6: 결과 수정/복사/다시생성/AI수정 + 최근 기록 + 로그.
