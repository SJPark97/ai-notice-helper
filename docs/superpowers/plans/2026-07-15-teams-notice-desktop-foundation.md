# AI 공지 도우미 — Plan 1: 토대(Foundation) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri 2 + Vue 3 + TypeScript 데스크톱 앱을 스캐폴드하고, 트레이 최소화(X=숨김, 우클릭 종료) 동작과 정적 UI 셸까지 갖춘 **실행 가능한 앱**을 만든다.

**Architecture:** Tauri 2 셸(Rust core + OS 웹뷰) 위에 Vue 3 렌더러. 이 단계에서는 로직 없이 앱 실행·창/트레이 수명주기·화면 레이아웃만 완성한다. 클립보드/AI/기록은 후속 Plan에서 얹는다.

**Tech Stack:** Tauri 2, Rust(rustup), Vue 3, TypeScript, Vite, Vitest(+@vue/test-utils)

## Global Constraints

- 대상 OS: macOS(우선), Windows. (이번 계획은 macOS에서 실행 검증)
- Node: 로컬 18.20.7 사용(설치돼 있음). Rust: rustup으로 신규 설치(미설치 상태).
- 앱 표시 이름: **AI 공지 도우미**. 창 타이틀 동일.
- 공지 유형 7종(순서 고정): 일반 / 배포 / 장애 / 점검 / 회의 / 긴급 / 기타.
- 출력 언어 옵션(초기): 한국어 / English / 日本語 / 中文.
- 코드 주석은 한글. 커밋 컨벤션: `feat|fix|chore|docs|refactor|build` 프리픽스 + 한글 제목/본문, **Co-Authored-By 금지**.
- 이 단계 산출물은 "실행되는 앱"이며 자동 테스트가 가능한 곳(UI 상수·렌더)은 Vitest로, 창/트레이 같은 OS 동작은 실행 관찰로 검증한다.

---

### Task 1: Rust 툴체인 설치 + Tauri 2 + Vue-TS 스캐폴드 (실행되는 빈 앱)

**Files:**
- Create: 프로젝트 루트에 Tauri+Vue 스캐폴드 (`package.json`, `index.html`, `src/`, `src-tauri/`, `vite.config.ts`, `tsconfig.json` 등)
- Note: 리포 루트에는 이미 `docs/`, `.git/` 존재. 스캐폴드는 현재 디렉토리에 인플레이스로 생성.

**Interfaces:**
- Produces: 실행 가능한 Tauri 앱. Rust 진입 파일 `src-tauri/src/lib.rs`(스캐폴드 기본), 설정 `src-tauri/tauri.conf.json`, 앱 식별자/제목. 후속 태스크가 이 파일들을 수정.

- [ ] **Step 1: Rust 설치(rustup)**

Run:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
rustc --version && cargo --version
```
Expected: `rustc 1.xx.x ...` / `cargo 1.xx.x ...` 버전 출력(에러 없음).

- [ ] **Step 2: 새 셸에서도 cargo 인식되게 PATH 확인**

Run:
```bash
echo 'source "$HOME/.cargo/env"' >> ~/.zshrc
source "$HOME/.cargo/env"
which cargo
```
Expected: `/Users/sjpark/.cargo/bin/cargo`

- [ ] **Step 3: 현재 디렉토리에 Tauri 2 + Vue-TS 스캐폴드**

Run (비대화형):
```bash
cd /Users/sjpark/Documents/project/ai
npm create tauri-app@latest . -- --template vue-ts --manager npm --identifier com.intocns.ainotice
```
비대화형 플래그가 막히거나 대화형으로 진입하면 아래를 선택:
- Project name: `.` (현재 디렉토리)
- Frontend language: **TypeScript**
- UI template: **Vue**
- Package manager: **npm**
- (기존 파일 있어도 진행/덮어쓰기 확인 시) `docs/`·`.git`은 유지, 나머지 스캐폴드 생성 승인.

Expected: `src/`, `src-tauri/`, `package.json`, `vite.config.ts` 등이 생성됨.

- [ ] **Step 4: 의존성 설치**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm install
```
Expected: `node_modules/` 생성, 에러 없음.

- [ ] **Step 5: 앱 이름/식별자 설정 확인·수정**

`src-tauri/tauri.conf.json`에서 `productName`, `identifier`, `app.windows[0].title` 을 확인/수정:
```json
{
  "productName": "AI 공지 도우미",
  "identifier": "com.intocns.ainotice",
  "app": {
    "windows": [
      {
        "title": "AI 공지 도우미",
        "width": 900,
        "height": 640
      }
    ]
  }
}
```
(스캐폴드 기본 구조 유지, 위 값만 반영. 기존 키는 지우지 말 것.)

- [ ] **Step 6: 개발 실행으로 창이 뜨는지 검증(수동)**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm run tauri dev
```
Expected: Rust 최초 컴파일 후 **"AI 공지 도우미" 창**이 뜨고 기본 스캐폴드 화면 표시. 확인 후 창 닫고 프로세스 종료(Ctrl+C).

- [ ] **Step 7: 산출물 정리 커밋용 .gitignore 확인 + 커밋**

`.gitignore`에 아래가 포함됐는지 확인(스캐폴드가 대개 생성). 없으면 추가:
```
node_modules
dist
src-tauri/target
```
Run:
```bash
git add -A
git commit -m "build: Tauri2 + Vue3 + TS 앱 스캐폴드 및 앱 이름 설정

- rustup으로 Rust 툴체인 설치 전제
- create-tauri-app(vue-ts)로 데스크톱 앱 스캐폴드
- productName/identifier/창 타이틀을 AI 공지 도우미로 설정"
```
Expected: 커밋 생성. `git status` clean(무시 대상 제외).

---

### Task 2: 트레이 최소화 동작 (X=트레이 숨김, 트레이 클릭=열기, 우클릭 종료)

**Files:**
- Modify: `src-tauri/Cargo.toml` (tauri features에 `tray-icon` 추가)
- Modify: `src-tauri/src/lib.rs` (setup에서 트레이 생성, on_window_event로 닫기 가로채기)
- Modify: `src-tauri/tauri.conf.json` (bundle에 트레이 아이콘 리소스 지정 필요 시)

**Interfaces:**
- Consumes: Task 1의 실행 가능한 앱, 메인 윈도우 label `"main"`(스캐폴드 기본).
- Produces: 앱이 트레이 상주. 닫기 버튼은 창을 숨김, 트레이 좌클릭은 창 복원, 트레이 우클릭 메뉴 "열기"/"종료" 제공. 후속 Plan은 이 수명주기를 전제로 클립보드 감시를 상주시킨다.

- [ ] **Step 1: Cargo features에 tray-icon 추가**

`src-tauri/Cargo.toml`의 tauri 의존성에 feature 추가:
```toml
tauri = { version = "2", features = ["tray-icon"] }
```
(기존 features가 있으면 배열에 `"tray-icon"`만 추가.)

- [ ] **Step 2: lib.rs에 트레이 + 닫기 가로채기 구현**

`src-tauri/src/lib.rs`의 `run()`(스캐폴드 기본 함수) 안 `tauri::Builder::default()` 체인을 아래로 수정. import는 파일 상단에 추가.

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 닫기(X) 버튼을 가로채 종료 대신 창 숨김 → 트레이 최소화
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // 트레이 우클릭 메뉴: 열기 / 종료
            let open_i = MenuItem::with_id(app, "open", "열기", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false) // 좌클릭은 창 열기, 우클릭에서만 메뉴
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0); // 진짜 종료 (사이드카는 후속 Plan에서 여기 정리)
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
(스캐폴드에 이미 `.invoke_handler(...)`나 플러그인 등록 라인이 있으면 지우지 말고 체인에 함께 유지.)

- [ ] **Step 3: 컴파일 확인**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
cargo build
```
Expected: 컴파일 성공(경고 허용, 에러 없음). 실패 시 import/feature 누락부터 확인.

- [ ] **Step 4: 트레이 동작 수동 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm run tauri dev
```
Expected(확인 항목):
- 앱 실행 시 상단 메뉴바(트레이)에 아이콘 등장.
- 창의 **닫기(X)** 클릭 → 창이 사라지고 **프로세스는 유지**(트레이 아이콘 남음).
- 트레이 아이콘 **좌클릭** → 창 다시 표시/포커스.
- 트레이 **우클릭 → "종료"** → 앱 완전 종료(트레이 아이콘 사라짐).
- 트레이 **우클릭 → "열기"** → 창 표시.

- [ ] **Step 5: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/
git commit -m "feat: 트레이 최소화 및 종료 동작 구현

- 닫기(X) 버튼을 가로채 창 숨김으로 처리(트레이 최소화)
- 트레이 좌클릭으로 창 복원, 우클릭 메뉴에 열기/종료 제공
- 종료 메뉴에서만 앱 완전 종료"
```

---

### Task 3: 정적 UI 셸 (메인/결과 화면 레이아웃 + Vitest 도입)

**Files:**
- Create: `src/constants/notice.ts` (공지 유형·언어 옵션 상수)
- Create: `src/views/MainView.vue` (메인: 메시지 리스트 자리 + 유형/언어 드롭다운 + 요구사항 입력 + 생성 버튼, 정적)
- Create: `src/views/ResultView.vue` (결과: 미리보기 영역 + 다시생성/AI수정/복사 버튼, 정적)
- Modify: `src/App.vue` (두 화면을 로컬 상태로 토글 표시)
- Create: `src/constants/notice.test.ts`, `src/views/MainView.test.ts` (Vitest)
- Modify: `package.json`(test 스크립트), `vite.config.ts`(Vitest 설정)

**Interfaces:**
- Consumes: Task 2까지의 실행 앱.
- Produces:
  - `NOTICE_TYPES: readonly string[]` — `["일반","배포","장애","점검","회의","긴급","기타"]`
  - `LANGUAGES: readonly { value: string; label: string }[]` — 한국어/English/日本語/中文
  - `MainView.vue`: 유형 select, 언어 select, 요구사항 textarea, "공지 생성" 버튼(현재는 클릭 시 App이 결과 화면으로 전환만).
  - 후속 Plan(클립보드/AI)은 이 화면의 슬롯·상태에 로직을 연결.

- [ ] **Step 1: Vitest 의존성 설치 + 설정**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm install -D vitest @vue/test-utils jsdom
```
`vite.config.ts`에 test 설정 추가(기존 defineConfig에 병합):
```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // 스캐폴드의 기존 server/clearScreen 등 설정은 유지
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```
`package.json` scripts에 추가:
```json
"test": "vitest run"
```

- [ ] **Step 2: 상수 테스트 작성(실패 확인용)**

Create `src/constants/notice.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NOTICE_TYPES, LANGUAGES } from "./notice";

describe("공지 상수", () => {
  it("공지 유형이 7종, 순서 고정이다", () => {
    expect([...NOTICE_TYPES]).toEqual([
      "일반",
      "배포",
      "장애",
      "점검",
      "회의",
      "긴급",
      "기타",
    ]);
  });

  it("언어 옵션에 한국어가 포함된다", () => {
    const values = LANGUAGES.map((l) => l.value);
    expect(values).toContain("한국어");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
```
Expected: FAIL — `./notice` 모듈/`NOTICE_TYPES` 없음.

- [ ] **Step 4: 상수 구현**

Create `src/constants/notice.ts`:
```ts
// 공지 유형(순서 고정)
export const NOTICE_TYPES = [
    "일반",
    "배포",
    "장애",
    "점검",
    "회의",
    "긴급",
    "기타",
] as const;

// 출력 언어 옵션
export const LANGUAGES = [
    { value: "한국어", label: "한국어" },
    { value: "English", label: "English" },
    { value: "日本語", label: "日本語" },
    { value: "中文", label: "中文" },
] as const;
```

- [ ] **Step 5: 상수 테스트 통과 확인**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
```
Expected: PASS (notice 테스트 2건).

- [ ] **Step 6: MainView 렌더 테스트 작성(실패 확인용)**

Create `src/views/MainView.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MainView from "./MainView.vue";

describe("MainView", () => {
  it("공지 유형 7종을 옵션으로 렌더한다", () => {
    const wrapper = mount(MainView);
    const options = wrapper.findAll('[data-test="notice-type"] option');
    expect(options).toHaveLength(7);
    expect(options[0].text()).toBe("일반");
  });

  it("공지 생성 버튼이 있다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="generate-btn"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `./MainView.vue` 없음.

- [ ] **Step 8: MainView 구현(정적)**

Create `src/views/MainView.vue`:
```vue
<template>
    <section class="main-view">
        <h1>AI 공지 도우미</h1>

        <!-- 복사한 메시지 리스트 (후속 Plan에서 클립보드 연결) -->
        <div class="msg-list" data-test="msg-list">
            <p class="placeholder">복사한 메시지가 여기에 표시됩니다.</p>
        </div>

        <!-- 공지 유형 -->
        <label>공지 유형</label>
        <select v-model="type" data-test="notice-type">
            <option v-for="t in NOTICE_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>

        <!-- 출력 언어 -->
        <label>언어</label>
        <select v-model="language" data-test="language">
            <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">
                {{ l.label }}
            </option>
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

const emit = defineEmits<{ (e: "generate"): void }>();

const type = ref<string>(NOTICE_TYPES[0]);
const language = ref<string>(LANGUAGES[0].value);
const requirement = ref<string>("");

// 현재 단계에서는 화면 전환만. 후속 Plan에서 실제 생성 연결.
const emitGenerate = () => {
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
.msg-list {
    min-height: 96px;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
}
.placeholder {
    color: #999;
    margin: 0;
}
</style>
```

- [ ] **Step 9: MainView 테스트 통과 확인**

Run: `npm test`
Expected: PASS (notice 2건 + MainView 2건).

- [ ] **Step 10: ResultView(정적) 구현**

Create `src/views/ResultView.vue`:
```vue
<template>
    <section class="result-view">
        <h1>생성된 공지</h1>

        <!-- 미리보기(후속 Plan에서 수정 가능/실데이터 연결) -->
        <textarea class="preview" data-test="preview" readonly placeholder="여기에 생성된 공지가 표시됩니다."></textarea>

        <div class="actions">
            <button data-test="regenerate-btn">다시 생성</button>
            <button data-test="refine-btn">AI 수정</button>
            <button data-test="copy-btn">복사</button>
            <button data-test="back-btn" @click="emitBack">← 뒤로</button>
        </div>
    </section>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: "back"): void }>();

const emitBack = () => {
    emit("back");
};
</script>

<style scoped>
.result-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
}
.preview {
    min-height: 240px;
}
.actions {
    display: flex;
    gap: 8px;
}
</style>
```

- [ ] **Step 11: App.vue에서 두 화면 토글**

Replace `src/App.vue` 내용:
```vue
<template>
    <MainView v-if="screen === 'main'" @generate="screen = 'result'" />
    <ResultView v-else @back="screen = 'main'" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import MainView from "./views/MainView.vue";
import ResultView from "./views/ResultView.vue";

// 현재 화면 상태 (main | result)
const screen = ref<"main" | "result">("main");
</script>

<style>
:root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
body {
    margin: 0;
}
</style>
```

- [ ] **Step 12: 전체 테스트 + 앱 실행 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
npm test
```
Expected: 모든 테스트 PASS.

Run:
```bash
npm run tauri dev
```
Expected(확인 항목):
- 메인 화면: 메시지 리스트 자리, 공지 유형(7종), 언어(4종), 요구사항 입력, "공지 생성" 버튼.
- "공지 생성" 클릭 → 결과 화면 전환. "← 뒤로" → 메인 복귀.
- 트레이 최소화 동작(Task 2)도 여전히 정상.

- [ ] **Step 13: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add -A
git commit -m "feat: 정적 UI 셸 및 Vitest 도입

- 공지 유형/언어 상수와 테스트 추가
- MainView(유형/언어/요구사항/생성), ResultView(미리보기/액션) 정적 구현
- App에서 메인·결과 화면 토글, Vitest 렌더 테스트 추가"
```

---

## 완료 기준 (Plan 1)

- `npm run tauri dev`로 "AI 공지 도우미" 앱이 실행된다.
- 닫기(X)로 트레이 최소화되고, 트레이에서 열기/종료가 동작한다.
- 메인·결과 화면 레이아웃이 뜨고 화면 전환이 된다.
- `npm test`가 통과한다.
- 여기까지 후속 Plan(클립보드/AI/결과 액션)이 얹힐 토대가 완성된다.

## 다음 Plan 예고 (이번 범위 아님)

- Plan 2: 클립보드 감시 모듈(Rust) + 메시지 리스트 실데이터/선택.
- Plan 3: llama-server 사이드카 JIT 다운로드 + 온디맨드 수명주기 + AI provider + 생성.
- Plan 4: 결과 수정/복사/다시생성/AI수정 + 최근 기록 + 로그.
