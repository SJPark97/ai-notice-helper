# AI 공지 도우미 — Plan 12: 코드 펜스 제거 + 전 형식 미리보기

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** (1) AI가 결과를 ` ```html ... ``` ` 같은 코드 펜스로 감싸는 문제 제거(시스템 프롬프트 지시 + 최종 결과 펜스 제거). (2) 추가된 형식(에디터/이모지/표/번호목록)도 미리보기가 되게 한다(표는 마크다운 테이블 렌더, 나머지는 텍스트로).

**Architecture:** Rust SYSTEM_PROMPT에 "코드 펜스로 감싸지 마라" 규칙 추가 + useGeneration이 생성 완료(done) 시 결과 전체를 감싼 코드 펜스를 제거(stripFence, 안전망). ResultView 미리보기는 형식을 "텍스트형(plain/emoji/numbered/editor)"과 "렌더형(markdown/table→marked, html→raw)"으로 나눠 처리.

**Tech Stack:** Rust, Vue 3, Vitest.

## Global Constraints

- Plan 1~11 위(main). ai.rs `SYSTEM_PROMPT` 존재. useGeneration은 스트리밍(runStream)으로 `notice://token` 누적, `notice://done`에 success+addRecord. ResultView `previewHtml`은 현재 html→result/markdown→marked/그외→""; 템플릿은 `state.format === 'plain'`만 `<pre>`, 그외 `v-html previewHtml`.
- 형식 7종: plain/editor/markdown/html/emoji/table/numbered. 텍스트형 = plain·editor·emoji·numbered. 렌더형 = markdown·table(둘 다 마크다운으로 렌더)·html(raw).
- stripFence: 결과 전체를 감싼 ```lang ... ``` 만 제거(내부 ```는 보존).
- 들여쓰기 스페이스, 한글 주석. 커밋 `feat|fix` + 한글 + **Co-Authored-By 절대 금지**.
- 범위: 펜스 제거 + 미리보기 매핑. 다른 기능 변경 없음.

---

### Task 1: 코드 펜스 제거 (SYSTEM_PROMPT + stripFence)

**Files:**
- Modify: `src-tauri/src/ai.rs` (SYSTEM_PROMPT)
- Modify: `src/composables/useGeneration.ts`, `src/composables/useGeneration.test.ts`

**Interfaces:**
- Produces: 생성/AI수정 결과에서 전체를 감싼 코드 펜스가 제거됨.

- [ ] **Step 1: SYSTEM_PROMPT에 코드 펜스 금지 추가**

`src-tauri/src/ai.rs`의 `SYSTEM_PROMPT` 끝에 문장 추가:
```rust
const SYSTEM_PROMPT: &str = "너는 회사 공지 작성 도우미다. 규칙: 핵심 내용만, 일정 우선, 영향 범위 명시, 작업 내용 정리, 담당자는 마지막, 존댓말, 불필요한 인삿말 제거, 가독성 높은 불릿 사용. 공지 유형은 내용에 맞게 스스로 판단한다. 반드시 지정된 언어로만 출력한다. 결과를 코드 블록이나 코드 펜스(```)로 감싸지 말고 공지 내용만 그대로 출력한다.";
```

- [ ] **Step 2: useGeneration에 stripFence + done 적용 테스트(실패 확인)**

`src/composables/useGeneration.test.ts`에 테스트 추가(기존 유지):
```ts
  it("코드 펜스로 감싼 결과는 펜스를 제거한다", async () => {
    invokeMock.mockImplementation(async () => {
      listeners["notice://token"]({ payload: "```html\n<b>공지</b>\n```" });
      listeners["notice://done"]({ payload: undefined });
    });
    await g.generate("m", "p", "한국어", "html");
    expect(g.state.result).toBe("<b>공지</b>");
    expect(g.state.status).toBe("success");
  });
```
Run `npm test` → RED.

- [ ] **Step 3: useGeneration에 stripFence 구현**

`src/composables/useGeneration.ts`에 헬퍼 추가하고 done 핸들러에서 적용. (파일 상단, export 함수 밖에 헬퍼 선언; runStream의 done 콜백에서 addRecord 전에 적용.)
```ts
// 결과 전체를 감싼 코드 펜스(```lang ... ```) 제거 (안전망)
const stripFence = (text: string): string => {
  const t = text.trim();
  const m = t.match(/^```[a-zA-Z]*\n?([\s\S]*?)\n?```$/);
  return m ? m[1].trim() : t;
};
```
runStream의 `notice://done` 콜백을 수정:
```ts
      unlistens.push(
        await listen("notice://done", () => {
          state.result = stripFence(state.result);
          state.status = "success";
          addRecord(state.result, language, Date.now() - start);
          cleanup();
        }),
      );
```

- [ ] **Step 4: 통과 확인 + 빌드**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri && source "$HOME/.cargo/env" && cargo build
cd /Users/sjpark/Documents/project/ai && npm test && npm run build
```
Expected: cargo 성공, npm test 전부 PASS(펜스 제거 테스트 + 기존 스트리밍 테스트 — 펜스 없는 기존 결과는 stripFence가 그대로 반환), 빌드 green.

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/src/ai.rs src/composables/useGeneration.ts src/composables/useGeneration.test.ts
git commit -m "fix: 결과를 감싼 코드 펜스 제거

- SYSTEM_PROMPT에 코드 블록으로 감싸지 말라는 규칙 추가
- useGeneration이 생성 완료 시 결과 전체를 감싼 코드 펜스(```lang) 제거"
```

---

### Task 2: 전 형식 미리보기 (ResultView)

**Files:**
- Modify: `src/views/ResultView.vue`

**Interfaces:**
- Consumes: useGeneration `state.format`/`state.result`. 미리보기가 7종 모두 올바르게 렌더.

- [ ] **Step 1: previewHtml을 렌더형(markdown/table/html) 처리로 확장**

`src/views/ResultView.vue`의 `previewHtml` computed를 아래로 교체(marked import 유지):
```ts
// 형식별 미리보기 HTML. 텍스트형(plain/editor/emoji/numbered)은 <pre>로 표시하므로 여기선 "" 반환
const previewHtml = computed<string>(() => {
  if (state.format === "html") return state.result;
  if (state.format === "markdown" || state.format === "table") {
    return marked.parse(state.result, { async: false }) as string;
  }
  return "";
});

// 텍스트형 형식(마크업 없이 그대로 보여줄 것)
const isPlainLike = computed<boolean>(() =>
  ["plain", "editor", "emoji", "numbered"].includes(state.format),
);
```
(파일에 이미 `computed`가 import돼 있음 — 확인.)

- [ ] **Step 2: 미리보기 템플릿을 isPlainLike 기준으로 교체**

`src/views/ResultView.vue`의 미리보기 블록(현재 `<pre v-if="state.format === 'plain'">` / `<div v-else v-html="previewHtml">`)을 교체:
```vue
        <pre v-if="isPlainLike" class="rendered-plain">{{ state.result }}</pre>
        <div v-else class="rendered-rich" v-html="previewHtml"></div>
```
(즉 plain/editor/emoji/numbered → `<pre>`(텍스트 그대로, 이모지·번호·줄바꿈 보존), markdown/table → marked 렌더, html → raw 렌더.)

- [ ] **Step 3: 표 렌더 스타일 추가**

`<style scoped>`에 마크다운 표가 보기 좋게 렌더되도록 추가(기존 유지):
```css
.rendered-rich table {
  border-collapse: collapse;
  margin: 8px 0;
}
.rendered-rich th,
.rendered-rich td {
  border: 1px solid var(--border);
  padding: 6px 10px;
  text-align: left;
}
</style>
```

- [ ] **Step 4: 테스트 + 빌드**

Run: `cd /Users/sjpark/Documents/project/ai && npm test && npm run build`
Expected: 전부 PASS(`preview`/`status-loading` 훅 유지, 기존 테스트 영향 없음), 빌드 green.

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/views/ResultView.vue
git commit -m "fix: 추가된 형식들도 미리보기 지원

- plain/editor/emoji/번호목록은 텍스트로, 표는 마크다운 테이블 렌더, html은 그대로
- 표 렌더용 스타일 추가"
```

---

## 완료 기준 (Plan 12)

- 어떤 형식으로 생성해도 결과가 ` ``` ` 코드 펜스로 감싸지지 않는다(복사 시 깔끔).
- 미리보기가 7종 모두 동작한다: 표는 실제 표로, 이모지/번호/에디터/일반텍스트는 서식대로, 마크다운/HTML은 렌더.
- `npm test` 통과, `npm run build` 그린, `cargo build` 성공.

## 다음 (선택, 범위 아님)

- Ollama 없이 배포(llama-server 사이드카 번들).
