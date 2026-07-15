# AI 공지 도우미 — Plan 6: 최근 생성 기록 (FR-012 + NFR-004 응답시간 로그)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 생성/AI수정에 성공한 공지를 최근 20건까지 로컬에 보관하고(FR-012), 각 기록에 응답 시간·시각·언어를 남긴다(NFR-004). MainView에서 최근 기록을 보고 하나를 눌러 결과 화면에서 다시 볼 수 있다. 원본 메시지는 저장하지 않는다.

**Architecture:** `useHistory` 컴포저블(localStorage, 최대 20, 최신순)이 기록을 담당. `useGeneration`이 생성/수정 성공 시 응답 시간을 측정해 `addRecord`를 호출. MainView에 "최근 기록" 섹션(목록 + 전체 지우기)을 추가하고, 항목 클릭 시 그 공지를 결과 화면에 로드해 보여준다.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, localStorage, Vitest(jsdom).

## Global Constraints

- Plan 1~5 위(main). 생성=`useGeneration`(state.status/result, generate/refine/setResult). 화면 전환은 MainView가 `generate` 이벤트 emit → App이 `screen='result'`.
- 기록 모델: `HistoryRecord = { id: string; notice: string; language: string; responseMs: number; createdAt: string }`. localStorage 키 `"ai-notice:history"`, 최대 20건, 최신순. **원본 메시지는 저장하지 않는다**(NFR-004).
- 응답 시간은 `useGeneration`에서 `Date.now()` 차이로 측정(앱 런타임이라 사용 가능).
- 들여쓰기 스페이스, `<script setup lang="ts">`, data-test 훅. 커밋 `feat` + 한글 + **Co-Authored-By 절대 금지**. 한글 주석.
- 이 Plan 범위: 성공한 생성/수정 기록 + 목록/보기/지우기. 실패 로그·배포 패키징은 범위 밖.

---

### Task 1: useHistory 컴포저블 (localStorage, TDD)

**Files:**
- Create: `src/composables/useHistory.ts`
- Test: `src/composables/useHistory.test.ts`

**Interfaces:**
- Produces: `useHistory()` →
  - `state.records: HistoryRecord[]` (최신순, 최대 20)
  - `HistoryRecord = { id: string; notice: string; language: string; responseMs: number; createdAt: string }`
  - `addRecord(notice: string, language: string, responseMs: number): void` (빈 notice 무시)
  - `clearHistory(): void`
  - `getRecord(id: string): HistoryRecord | undefined`
  - 모듈 수준 단일 상태, 변경 시 localStorage persist.

- [ ] **Step 1: 실패 테스트 작성**

Create `src/composables/useHistory.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useHistory } from "./useHistory";

describe("useHistory", () => {
  const h = useHistory();
  beforeEach(() => {
    h.state.records.splice(0);
    localStorage.clear();
  });

  it("기록을 최신순으로 추가하고 저장한다", () => {
    h.addRecord("공지1", "한국어", 1200);
    h.addRecord("공지2", "한국어", 800);
    expect(h.state.records).toHaveLength(2);
    expect(h.state.records[0].notice).toBe("공지2");
    expect(h.state.records[0].responseMs).toBe(800);
    expect(JSON.parse(localStorage.getItem("ai-notice:history") as string)).toHaveLength(2);
  });

  it("빈 notice는 기록하지 않는다", () => {
    h.addRecord("   ", "한국어", 100);
    expect(h.state.records).toHaveLength(0);
  });

  it("최대 20건만 보관한다", () => {
    for (let i = 0; i < 25; i++) h.addRecord(`공지 ${i}`, "한국어", 100);
    expect(h.state.records).toHaveLength(20);
    expect(h.state.records[0].notice).toBe("공지 24");
  });

  it("getRecord로 조회하고 clearHistory로 비운다", () => {
    h.addRecord("찾을공지", "English", 500);
    const id = h.state.records[0].id;
    expect(h.getRecord(id)?.notice).toBe("찾을공지");
    h.clearHistory();
    expect(h.state.records).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("ai-notice:history") as string)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: FAIL — `./useHistory` 없음.

- [ ] **Step 3: 컴포저블 구현**

Create `src/composables/useHistory.ts`:
```ts
import { reactive } from "vue";

// 최근 생성 기록 (원본 메시지는 저장하지 않음)
export interface HistoryRecord {
  id: string;
  notice: string;
  language: string;
  responseMs: number;
  createdAt: string;
}

const STORAGE_KEY = "ai-notice:history";
const MAX_RECORDS = 20;

// localStorage에서 초기 로드 (손상 시 빈 배열)
const load = (): HistoryRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryRecord[]) : [];
  } catch {
    return [];
  }
};

// 앱 전역 단일 상태
const state = reactive({ records: load() as HistoryRecord[] });

// 현재 상태를 localStorage에 저장
const persist = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
};

let seq = 0;
const genId = (): string => `h${Date.now()}_${++seq}`;

export function useHistory() {
  // 생성 성공 공지를 기록 (빈 값 무시, 최신순, 최대 20)
  const addRecord = (notice: string, language: string, responseMs: number): void => {
    if (!notice.trim()) return;
    state.records.unshift({
      id: genId(),
      notice,
      language,
      responseMs,
      createdAt: new Date().toISOString(),
    });
    if (state.records.length > MAX_RECORDS) {
      state.records.splice(MAX_RECORDS);
    }
    persist();
  };

  // 전체 기록 삭제
  const clearHistory = (): void => {
    state.records.splice(0);
    persist();
  };

  // id로 조회
  const getRecord = (id: string): HistoryRecord | undefined =>
    state.records.find((r) => r.id === id);

  return { state, addRecord, clearHistory, getRecord };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/sjpark/Documents/project/ai && npm test`
Expected: PASS (기존 31건 + useHistory 4건 = 35).

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/useHistory.ts src/composables/useHistory.test.ts
git commit -m "feat: 최근 생성 기록 컴포저블 추가

- useHistory: 성공 공지 최근 20건 보관(응답시간/언어/시각), localStorage 영구화
- 원본 메시지는 저장하지 않음. 단위 테스트 4건"
```

---

### Task 2: 생성 시 기록 적재 + MainView 최근 기록 UI

**Files:**
- Modify: `src/composables/useGeneration.ts` (성공 시 응답시간 측정 + addRecord)
- Modify: `src/composables/useGeneration.test.ts` (기록 적재 검증 추가)
- Modify: `src/views/MainView.vue` (최근 기록 섹션 + 항목 보기)
- Modify: `src/views/MainView.test.ts` (기록 목록 렌더/클릭 테스트)

**Interfaces:**
- Consumes: `useHistory`(Task 1).
- Produces: 생성/AI수정 성공 시 기록 자동 저장. MainView에 최근 기록 목록, 항목 클릭 시 그 공지를 결과 화면(useGeneration.setResult)에 로드하고 `generate` emit으로 화면 전환.

- [ ] **Step 1: useGeneration 기록 적재 테스트 추가(실패 확인)**

`src/composables/useGeneration.test.ts`에 아래 테스트 추가(기존 유지, 상단에 `import { useHistory } from "./useHistory";` 추가):
```ts
  it("generate 성공 시 최근 기록에 추가된다", async () => {
    const h = useHistory();
    h.clearHistory();
    invokeMock.mockResolvedValue("생성된 공지 본문");
    await g.generate("메시지", "지시", "한국어");
    expect(h.state.records[0].notice).toBe("생성된 공지 본문");
    expect(h.state.records[0].language).toBe("한국어");
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — 아직 useGeneration이 기록을 적재하지 않음.

- [ ] **Step 3: useGeneration에 응답시간 측정 + 기록 적재**

`src/composables/useGeneration.ts`를 수정: `useHistory` import, generate/refine 성공 시 응답시간 측정 후 `addRecord`. (기존 로직 유지.)
```ts
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useHistory } from "./useHistory";

type Status = "idle" | "loading" | "success" | "error";

const state = reactive({
  status: "idle" as Status,
  result: "",
  error: "",
});

let last = { message: "", prompt: "", language: "한국어" };

export function useGeneration() {
  const { addRecord } = useHistory();

  // 공지 생성
  const generate = async (message: string, prompt: string, language: string): Promise<void> => {
    last = { message, prompt, language };
    state.status = "loading";
    state.error = "";
    const start = Date.now();
    try {
      state.result = await invoke<string>("generate_notice", { message, prompt, language });
      state.status = "success";
      addRecord(state.result, language, Date.now() - start);
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
    const start = Date.now();
    try {
      state.result = await invoke<string>("refine_notice", {
        current: state.result,
        instruction,
        language: last.language,
      });
      state.status = "success";
      addRecord(state.result, last.language, Date.now() - start);
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

- [ ] **Step 4: MainView 기록 목록 테스트 추가(실패 확인)**

`src/views/MainView.test.ts`에 아래 describe 추가(상단 import에 `useHistory` 추가):
```ts
import { useHistory } from "../composables/useHistory";

describe("MainView 최근 기록", () => {
  const h = useHistory();
  beforeEach(() => {
    h.state.records.splice(0);
    localStorage.clear();
  });

  it("최근 기록을 목록으로 렌더한다", () => {
    h.addRecord("지난 공지 본문입니다", "한국어", 900);
    const wrapper = mount(MainView);
    const items = wrapper.findAll('[data-test="history-item"]');
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain("지난 공지");
  });

  it("기록 항목 클릭 시 generate 이벤트로 화면을 전환한다", async () => {
    h.addRecord("불러올 공지", "한국어", 500);
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="history-item"]').trigger("click");
    expect(wrapper.emitted("generate")).toBeTruthy();
  });
});
```

- [ ] **Step 5: 실패 확인**

Run: `npm test`
Expected: FAIL — MainView에 history UI 없음.

- [ ] **Step 6: MainView에 최근 기록 섹션 추가**

`src/views/MainView.vue`에 최근 기록 섹션을 추가하고 script에 `useHistory`/`useGeneration` 연결. (기존 클립보드/프롬프트/언어/생성 구조 유지.)

script `<script setup lang="ts">`에 추가:
```ts
import { useHistory } from "../composables/useHistory";
import { useGeneration } from "../composables/useGeneration";

const { state: historyState, clearHistory } = useHistory();
const { setResult, state: genState } = useGeneration();

// 기록 항목 미리보기 (한 줄 80자)
const historyPreview = (notice: string): string => {
  const oneLine = notice.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
};

// 기록 클릭 → 결과 화면에 로드
const onSelectHistory = (id: string): void => {
  const rec = historyState.records.find((r) => r.id === id);
  if (!rec) return;
  setResult(rec.notice);
  genState.status = "success";
  emit("generate");
};
```
(이미 `useGeneration`의 `generate`를 쓰고 있으면 구조 분해에 `setResult`, `state: genState`를 함께 추가한다. `emitGenerate`(생성 버튼)와 충돌 없음.)

template의 "공지 생성" 버튼 아래(검증 메시지 다음)에 최근 기록 섹션 추가:
```vue
    <!-- 최근 생성 기록 -->
    <div v-if="historyState.records.length" class="history">
      <div class="history-head">
        <span>최근 기록</span>
        <button class="clear-btn" data-test="history-clear" @click="clearHistory">기록 지우기</button>
      </div>
      <button
        v-for="r in historyState.records"
        :key="r.id"
        type="button"
        class="history-item"
        data-test="history-item"
        @click="onSelectHistory(r.id)"
      >
        {{ historyPreview(r.notice) }}
      </button>
    </div>
```

scoped 스타일에 추가:
```css
.history {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.history-head {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: 13px;
}
.history-head .clear-btn {
  margin-left: auto;
}
.history-item {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--item-bg);
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}
.history-item:hover {
  border-color: var(--primary);
}
```

- [ ] **Step 7: 통과 확인 + 빌드**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
npm run build
```
Expected: 테스트 PASS(useGeneration 기록 + MainView 기록 목록 포함), 빌드 green.

- [ ] **Step 8: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add -A
git commit -m "feat: 최근 생성 기록 UI 및 자동 적재

- useGeneration: 생성/AI수정 성공 시 응답시간 측정해 기록 저장
- MainView: 최근 기록 목록, 항목 클릭 시 결과 화면에 로드, 기록 지우기"
```

---

## 완료 기준 (Plan 6)

- 공지를 생성하면 최근 기록에 자동 저장되고(응답시간 포함), MainView에 목록으로 보인다.
- 기록 항목을 클릭하면 그 공지가 결과 화면에 로드된다.
- 최근 20건까지 유지되고, 앱을 껐다 켜도 남아 있으며(localStorage), "기록 지우기"로 비운다.
- 원본 메시지는 저장되지 않는다.
- `npm test` 통과, `npm run build` 그린.

## 다음 (선택, 범위 아님)

- 배포용: llama-server 사이드카 번들(Ollama 없이 동작), 자동 업데이트, 코드사이닝.
- 실패 진단 로그(성공/실패 모두), 온디맨드 모델 언로드 튜닝.
