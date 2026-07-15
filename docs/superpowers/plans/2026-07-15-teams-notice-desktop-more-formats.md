# AI 공지 도우미 — Plan 11: 출력 형식 확장 + 탭 전환 시 선택 유지

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** (1) 출력 형식을 7종으로 확장(일반텍스트/에디터/마크다운/HTML/이모지/표/번호목록), (2) 탭(공지 생성↔전역 규칙)을 오가도 공지 생성쪽 선택 상태(형식·언어·프롬프트·선택 메시지 등)가 초기화되지 않게 유지.

**Architecture:** Rust `format_rule`에 형식별 지시문 arm 추가 + 프론트 `FORMATS` 상수 확장(둘의 value가 일치). App에서 탭 콘텐츠를 `v-if`(언마운트) 대신 `v-show`(유지)로 바꿔 MainView가 언마운트되지 않게 해 로컬 상태를 보존.

**Tech Stack:** Rust, Vue 3, Vitest.

## Global Constraints

- Plan 1~10 위(main). ai.rs `format_rule(format)`는 markdown/html/그외(plain) arm 보유. 프론트 `FORMATS`(constants/notice.ts) = plain/markdown/html. useGeneration은 format을 그대로 Rust에 전달.
- FORMATS의 value와 Rust format_rule의 match arm 문자열이 **정확히 일치**해야 함.
- App.vue는 4-space 들여쓰기(기존 파일 유지). 그 외 파일은 기존 들여쓰기 유지. 커밋 `feat` + 한글 + **Co-Authored-By 절대 금지**. 한글 주석.
- 범위: 형식 4종 추가 + 탭 상태 유지. 다른 기능 변경 없음.

---

### Task 1: 출력 형식 4종 추가 (Rust + 상수)

**Files:**
- Modify: `src-tauri/src/ai.rs` (format_rule arm 추가)
- Modify: `src/constants/notice.ts` (FORMATS 확장)

**Interfaces:**
- Produces: 형식 값 `emoji`/`table`/`numbered`/`editor` 추가. FORMATS 7종.

- [ ] **Step 1: Rust format_rule에 arm 추가**

`src-tauri/src/ai.rs`의 `format_rule` match에 arm 추가(기존 markdown/html/기본 유지):
```rust
fn format_rule(format: &str) -> &'static str {
    match format {
        "markdown" => "출력은 마크다운 형식으로 작성한다(강조 **, 불릿 -).",
        "html" => "출력은 HTML로 작성한다(<b>, <ul>, <li> 등 태그 사용).",
        "emoji" => "출력은 이모지로 꾸민 형식으로 작성한다. 제목 앞에 📢, 각 항목 앞에 내용에 맞는 이모지(✅ 📅 👤 ⚠️ 등)를 붙여 가독성 있게 한다. 마크다운 기호(*, **, #)는 쓰지 않는다.",
        "table" => "출력은 핵심 항목(일정·영향 범위·작업 내용·담당자 등)을 표로 정리한다. 마크다운 표 형식(| 항목 | 내용 |)을 사용한다.",
        "numbered" => "출력은 각 항목을 1. 2. 3. 번호 목록으로 작성한다. 마크다운 별표 강조(*, **)는 쓰지 않는다.",
        "editor" => "출력은 문서 에디터에 바로 붙여넣기 좋은 깔끔한 문서 형식으로 작성한다. 마크다운 기호(*, #, -)는 쓰지 않고, 제목과 소제목은 줄바꿈과 공백으로 구분하며 본문은 문단으로, 항목 나열은 • 불릿과 적절한 줄간격으로 보기 좋게 작성한다.",
        _ => "출력은 마크다운 문법이나 별표(*, **) 없이 순수 일반 텍스트로 작성한다. 항목 구분은 • 또는 - 불릿과 줄바꿈으로만 한다.",
    }
}
```

- [ ] **Step 2: FORMATS 상수 확장**

`src/constants/notice.ts`의 `FORMATS`를 아래로 교체:
```ts
// 출력 형식 (문서 에디터 타겟이라 기본 plain, value는 Rust format_rule과 일치)
export const FORMATS = [
  { value: "plain", label: "일반 텍스트" },
  { value: "editor", label: "에디터 형식" },
  { value: "markdown", label: "마크다운" },
  { value: "html", label: "HTML" },
  { value: "emoji", label: "이모지 스타일" },
  { value: "table", label: "표 형식" },
  { value: "numbered", label: "번호 목록" },
] as const;
```

- [ ] **Step 3: 빌드 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri && source "$HOME/.cargo/env" && cargo build
cd /Users/sjpark/Documents/project/ai && npm test && npm run build
```
Expected: cargo 성공, npm test 전부 PASS(형식 드롭다운 v-for가 7종 자동 렌더 — 기존 존재 테스트 영향 없음), 빌드 green.

- [ ] **Step 4: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/src/ai.rs src/constants/notice.ts
git commit -m "feat: 출력 형식 4종 추가(에디터/이모지/표/번호목록)

- format_rule에 emoji/table/numbered/editor 지시문 arm 추가
- FORMATS 상수 7종으로 확장(에디터 형식 등)"
```

---

### Task 2: 탭 전환 시 선택 상태 유지 (App v-show)

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: 없음. MainView를 언마운트하지 않아 형식/언어/프롬프트/선택 메시지 등 로컬 상태가 탭 전환 후에도 유지된다.

- [ ] **Step 1: App 탭 콘텐츠를 v-if → v-show로 교체**

`src/App.vue` template에서 탭 콘텐츠 블록을 교체한다(테마토글·nav.tabs·script·style은 유지). `<template v-if>`는 v-show를 못 쓰므로 `<div>`로 감싼다:
```vue
    <div v-show="tab === 'notice'">
        <MainView v-show="screen === 'main'" @generate="screen = 'result'" />
        <ResultView v-show="screen === 'result'" @back="screen = 'main'" />
    </div>
    <GlobalRulesView v-show="tab === 'rules'" />
```
(기존 `<template v-if="tab === 'notice'">...</template>`와 `<GlobalRulesView v-else />`를 위 내용으로 대체. MainView/ResultView가 항상 마운트된 채 v-show로 표시만 토글되어 상태가 유지됨.)

- [ ] **Step 2: 테스트 + 빌드**

Run: `cd /Users/sjpark/Documents/project/ai && npm test && npm run build`
Expected: 전부 PASS(App 관련 테스트 없거나 마운트 방식 무관), 빌드 green. 두 뷰가 동시에 마운트되지만 v-show로 하나만 표시됨.

- [ ] **Step 3: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/App.vue
git commit -m "feat: 탭 전환 시 공지 생성 선택 상태 유지

- 탭 콘텐츠를 v-if(언마운트)에서 v-show(유지)로 변경
- MainView가 언마운트되지 않아 형식/언어/프롬프트/선택 메시지 유지"
```

---

## 완료 기준 (Plan 11)

- 출력 형식 드롭다운에 7종(일반 텍스트/에디터 형식/마크다운/HTML/이모지 스타일/표 형식/번호 목록)이 뜨고, 각 형식으로 생성된다.
- 공지 생성쪽에서 형식·언어·프롬프트·메시지를 고른 뒤 전역 규칙 탭에 갔다 돌아와도 그 선택이 그대로 유지된다.
- `npm test` 통과, `npm run build` 그린, `cargo build` 성공.

## 다음 (선택, 범위 아님)

- Ollama 없이 배포(llama-server 사이드카 번들).
