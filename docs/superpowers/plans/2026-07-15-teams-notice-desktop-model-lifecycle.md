# AI 공지 도우미 — Plan 8: 모델 온디맨드 수명주기 (창 show=깨우기, hide=재우기)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 앱이 트레이로 최소화(백그라운드)되면 모델을 언로드해 RAM을 반납하고, 다시 열릴 때(및 시작 시) 모델을 미리 로드(preload)해 두어 실제 생성 체감 속도를 빠르게 한다.

**Architecture:** Ollama의 `keep_alive`로 제어. `keep_alive: -1`(무한 유지)로 미리 로드, `keep_alive: 0`으로 즉시 언로드. Rust `ai` 모듈에 `preload_model`/`unload_model` 추가하고, lib.rs의 창 이벤트(닫기=hide, 트레이 열기/좌클릭=show)와 setup(시작)에 `tauri::async_runtime::spawn`으로 물린다. 프론트 변경 없음.

**Tech Stack:** Rust, reqwest(기존), Tauri async_runtime.

## Global Constraints

- Plan 1~7 위(main). ai.rs는 이미 Ollama(`gemma4:e4b`) 호출 코드 보유(`MODEL` 상수, reqwest). lib.rs는 트레이 최소화(닫기=hide, on_menu_event "open"=show, on_tray_icon_event 좌클릭=show)와 setup(트레이 구성) 보유.
- **기존 lib.rs 빌더 체인/트레이/invoke_handler는 전부 보존**하고, preload/unload 호출만 추가한다.
- keep_alive 제어는 Ollama 네이티브 API `http://localhost:11434/api/generate`에 `{model, keep_alive}`(프롬프트 없이) POST. serde_json 없이 serde 구조체로 직렬화(새 의존 추가 금지).
- 스페이스 들여쓰기, 한글 주석. 커밋 `feat` + 한글 + **Co-Authored-By 절대 금지**.
- 범위: 모델 preload/unload를 창 show/hide/startup에 연결만. 실패는 조용히 무시(생성 자체는 필요 시 Ollama가 알아서 로드하므로 앱 동작에 지장 없음).

---

### Task 1: 모델 preload/unload + 창 이벤트 연결

**Files:**
- Modify: `src-tauri/src/ai.rs` (preload_model / unload_model 추가)
- Modify: `src-tauri/src/lib.rs` (창 hide=unload, show/startup=preload)

**Interfaces:**
- Produces: `ai::preload_model() -> Result<(), String>`, `ai::unload_model() -> Result<(), String>` (Rust 내부 호출용).

- [ ] **Step 1: ai.rs에 preload/unload 추가**

`src-tauri/src/ai.rs`에 아래를 추가(기존 `MODEL` 상수, `generate_notice`/`refine_notice` 유지). `Serialize`는 이미 import되어 있음:
```rust
// Ollama 네이티브 API (keep_alive로 모델 로드/언로드 제어)
const NATIVE_URL: &str = "http://localhost:11434/api/generate";

#[derive(Serialize)]
struct KeepAliveReq<'a> {
    model: &'a str,
    keep_alive: i64,
}

// 프롬프트 없이 keep_alive만 보내 모델 로드/유지시간을 제어한다.
// keep_alive: -1 = 무한 유지(미리 로드), 0 = 즉시 언로드
async fn set_keep_alive(keep_alive: i64) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = KeepAliveReq { model: MODEL, keep_alive };
    client
        .post(NATIVE_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// 모델 미리 로드(창을 열 때/시작 시) — 이후 유지해 생성 체감 속도 향상
pub async fn preload_model() -> Result<(), String> {
    set_keep_alive(-1).await
}

// 모델 언로드(트레이로 최소화될 때) — RAM 반납
pub async fn unload_model() -> Result<(), String> {
    set_keep_alive(0).await
}
```

- [ ] **Step 2: lib.rs — 닫기(hide) 시 언로드**

`on_window_event`의 CloseRequested 처리에 언로드 spawn 추가(기존 hide/prevent_close 유지):
```rust
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
                // 트레이로 최소화 시 모델 언로드(RAM 반납)
                tauri::async_runtime::spawn(async { let _ = ai::unload_model().await; });
            }
        })
```

- [ ] **Step 3: lib.rs — setup(시작) 시 미리 로드**

`.setup(|app| {` 바로 다음 줄에 시작 시 preload spawn 추가(기존 트레이 구성 유지):
```rust
        .setup(|app| {
            // 앱 시작 시 모델 미리 로드(첫 생성 체감 속도 향상)
            tauri::async_runtime::spawn(async { let _ = ai::preload_model().await; });

            // 트레이 우클릭 메뉴: 열기 / 종료
            let open_i = MenuItem::with_id(app, "open", "열기", true, None::<&str>)?;
            // ... 기존 트레이 구성 그대로 ...
```

- [ ] **Step 4: lib.rs — 트레이 "열기" 메뉴 및 좌클릭(show) 시 미리 로드**

on_menu_event "open" 분기와 on_tray_icon_event 좌클릭 분기에 각각 preload spawn 추가(기존 show/set_focus 유지):
```rust
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                        // 창을 열 때 모델 미리 로드
                        tauri::async_runtime::spawn(async { let _ = ai::preload_model().await; });
                    }
                    "quit" => {
                        app.exit(0);
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
                        // 트레이에서 다시 열 때 모델 미리 로드
                        tauri::async_runtime::spawn(async { let _ = ai::preload_model().await; });
                    }
                })
```

- [ ] **Step 5: 빌드 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo build
```
Expected: 컴파일 성공(에러 없음). `tauri::async_runtime::spawn`의 future가 Send+'static이라 경고/에러 없어야 함.

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/
git commit -m "feat: 모델 온디맨드 수명주기(창 최소화 시 언로드, 열 때 미리 로드)

- ai.rs: keep_alive 제어로 preload_model(-1)/unload_model(0) 추가
- lib.rs: 시작·트레이 열기·좌클릭 시 preload, 닫기(트레이 최소화) 시 unload"
```

---

### Task 2: 창 최소 크기 설정 (계속 줄어들지 않게)

**Files:**
- Modify: `src-tauri/tauri.conf.json` (main window에 minWidth/minHeight)

**Interfaces:** 없음(설정만).

- [ ] **Step 1: tauri.conf.json에 최소 크기 추가**

`src-tauri/tauri.conf.json`의 `app.windows[0]`(메인 창, title "AI 공지 도우미", width 900, height 640)에 `minWidth`/`minHeight`를 추가한다(기존 키 유지):
```json
{
  "title": "AI 공지 도우미",
  "width": 900,
  "height": 640,
  "minWidth": 480,
  "minHeight": 560
}
```
(정확한 키 이름은 설치된 Tauri 버전 스키마 기준. Tauri 2는 `minWidth`/`minHeight` 카멜케이스. 다른 키가 이미 있으면 지우지 말고 위 두 개만 추가.)

- [ ] **Step 2: 빌드/스키마 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri
source "$HOME/.cargo/env"
cargo build
```
Expected: 컴파일 성공. tauri.conf.json 스키마 검증 통과(minWidth/minHeight 유효 키). 실패 시 스키마(`gen/schemas`)에서 올바른 키명 확인.

- [ ] **Step 3: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/tauri.conf.json
git commit -m "feat: 창 최소 크기 설정

- 메인 창 minWidth 480 / minHeight 560으로 과도한 축소 방지"
```

---

## 완료 기준 (Plan 8)

- 앱 시작 후 잠시 뒤 `curl -s http://localhost:11434/api/ps`에 `gemma4:e4b`가 로드됨.
- 창을 닫아(트레이 최소화) 잠시 뒤 `api/ps`에서 모델이 사라짐(언로드).
- 트레이에서 다시 열면 `api/ps`에 다시 로드됨.
- `cargo build` 성공.
- **창을 최소 크기(480×560) 아래로는 줄일 수 없다.**
- (효과) 창을 열어둔 상태에서 생성 시 모델이 이미 warm이라 첫 생성이 빠르다.

## 다음 (선택, 범위 아님)

- 스트리밍 생성(토큰 실시간). 배포용 llama-server 사이드카 번들.
