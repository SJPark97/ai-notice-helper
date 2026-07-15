# AI 공지 도우미 — Plan 13: Ollama 런타임 번들 + 첫 실행 모델 자동 다운로드

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 앱에 Ollama 런타임을 번들해서 사용자가 별도 설치 없이 설치파일만으로 쓰게 하고, 첫 실행 시 `gemma4:e4b` 모델을 자동 다운로드(진행률 표시)한 뒤 사용하게 한다. 이후에는 완전 오프라인 동작.

**Architecture:** 플랫폼별 Ollama 런타임 폴더(CPU + 경량 GPU 가속만 포함)를 `bundle.resources`로 앱에 번들한다. Rust가 리소스 경로의 `ollama` 바이너리를 `std::process`로 직접 spawn(전용 포트 `11535`, 모델은 기본 `~/.ollama/models` 재사용)하고 앱 종료 시 kill한다. 프론트는 부트스트랩 화면에서 런타임 헬스체크 → 모델 존재 확인 → 없으면 `/api/pull` 스트리밍 다운로드(진행률 이벤트) → 준비 완료되면 기존 화면으로 전환한다. CI가 플랫폼별 Ollama를 받아 프루닝 후 번들한다.

**Tech Stack:** Rust(std::process, reqwest, tauri path/resource), Vue 3, Vitest, GitHub Actions.

## Global Constraints

- Plan 1~12 위(main). `ai.rs`는 `AI_URL`/`NATIVE_URL`/`NATIVE_CHAT_URL` 3개 상수가 모두 `http://localhost:11434/...`를 가리킴(각각 `/v1/chat/completions`, `/api/generate`, `/api/chat`). `preload_model`/`unload_model`도 존재(`keep_alive`로 모델 로드/언로드). 스트리밍은 `reqwest` `resp.chunk()` + `tauri::Emitter`의 `app.emit("notice://token"/"notice://done"/"notice://error")` 패턴.
- `lib.rs`: `.plugin(tauri_plugin_clipboard::init())`, `on_window_event`에서 CloseRequested→hide+prevent_close+`unload_model` spawn, `setup`에서 `preload_model` spawn + 트레이(열기/종료), `invoke_handler![greet, ai::generate_notice, ai::refine_notice, ai::generate_notice_stream, ai::refine_notice_stream]`. 51번 줄 "quit"에 "사이드카는 후속 Plan에서 여기 정리" 주석 존재 — 이 Plan에서 정리.
- `App.vue`: 4-space 들여쓰기. 테마 토글 + 탭(공지 생성/전역 규칙), `v-show`로 MainView/ResultView/GlobalRulesView 전환. `useClipboardWatch`, `initTheme` 호출.
- 전용 포트 **`11535`**(사용자가 이미 돌리는 공식 Ollama의 11434와 충돌 방지). 모델 저장은 기본 경로 재사용(OLLAMA_MODELS 미지정 → `~/.ollama/models`)라 기존 설치분이 있으면 재다운로드 안 함.
- 모델명 상수 **`gemma4:e4b`**. Ollama 버전 **`v0.32.0`** 고정(모델은 ollama 0.20+ 필요).
- 런타임 폴더 `src-tauri/ollama-runtime/`는 **git에 커밋하지 않음**(용량 큼) — `.gitignore` 처리, CI/로컬 스크립트가 채움.
- macOS 런타임: `ollama-darwin.tgz`(유니버설, 약 463MB 압축해제) 전량 번들(MLX Metal 가속 유지). Windows 런타임: `ollama-windows-amd64.zip`에서 `lib/ollama/cuda_v12`·`cuda_v13` 제외(약 1.75GB↓), `vulkan`+CPU 유지(약 125MB).
- 들여쓰기·따옴표·주석은 각 파일 기존 스타일 유지. 커밋 `feat|fix|chore|build` + 한글 제목/본문 + **Co-Authored-By 절대 금지**. 커밋/푸시는 사용자 명시 요청 시에만(이 Plan은 로컬 커밋까지만).
- 범위: 런타임 번들 + 첫 실행 다운로드 + CI. 생성/형식/미리보기 등 기존 기능 로직은 포트 변경 외 건드리지 않음.

---

### Task 1: 런타임 fetch 스크립트 + 번들 설정 + gitignore

**Files:**
- Create: `scripts/fetch-ollama.sh`
- Create: `scripts/fetch-ollama.ps1`
- Modify: `src-tauri/tauri.conf.json` (bundle.resources)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `src-tauri/ollama-runtime/`에 플랫폼별 ollama 런타임 배치. tauri가 이 폴더를 리소스로 번들.

- [ ] **Step 1: macOS/Linux fetch 스크립트 작성**

`scripts/fetch-ollama.sh`:
```bash
#!/usr/bin/env bash
# Ollama 런타임을 내려받아 src-tauri/ollama-runtime/ 에 배치 (macOS)
set -euo pipefail
OLLAMA_VERSION="v0.32.0"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src-tauri/ollama-runtime"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ "$(uname -s)" != "Darwin" ]; then
  echo "이 스크립트는 macOS 전용입니다. Windows는 fetch-ollama.ps1 을 사용하세요." >&2
  exit 1
fi

echo "macOS Ollama 런타임(${OLLAMA_VERSION}) 다운로드 중..."
curl -fsSL -o "$TMP/ollama.tgz" \
  "https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-darwin.tgz"

rm -rf "$DEST"
mkdir -p "$DEST"
tar -xzf "$TMP/ollama.tgz" -C "$DEST"

echo "완료: $DEST"
ls "$DEST/ollama" >/dev/null || { echo "ollama 바이너리가 없습니다." >&2; exit 1; }
```
실행 권한 부여: `chmod +x scripts/fetch-ollama.sh`

- [ ] **Step 2: Windows fetch 스크립트 작성(CUDA 제외)**

`scripts/fetch-ollama.ps1`:
```powershell
# Ollama 런타임을 내려받아 src-tauri\ollama-runtime\ 에 배치, NVIDIA CUDA 제외 (Windows)
$ErrorActionPreference = "Stop"
$OllamaVersion = "v0.32.0"
$Root = Split-Path -Parent $PSScriptRoot
$Dest = Join-Path $Root "src-tauri\ollama-runtime"
$Tmp  = Join-Path $env:TEMP "ollama-fetch"
$Zip  = Join-Path $Tmp "ollama.zip"

if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
if (Test-Path $Tmp)  { Remove-Item -Recurse -Force $Tmp }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
New-Item -ItemType Directory -Force -Path $Tmp  | Out-Null

Write-Host "Windows Ollama 런타임($OllamaVersion) 다운로드 중..."
Invoke-WebRequest -Uri "https://github.com/ollama/ollama/releases/download/$OllamaVersion/ollama-windows-amd64.zip" -OutFile $Zip
Expand-Archive -Path $Zip -DestinationPath $Dest -Force

# 용량 절감: NVIDIA CUDA 라이브러리 제외(약 1.75GB). Vulkan/CPU 가속만 유지.
Remove-Item -Recurse -Force (Join-Path $Dest "lib\ollama\cuda_v12") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $Dest "lib\ollama\cuda_v13") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $Tmp

if (-not (Test-Path (Join-Path $Dest "ollama.exe"))) { throw "ollama.exe 가 없습니다." }
Write-Host "완료: $Dest"
```

- [ ] **Step 3: tauri.conf.json 에 resources 추가**

`src-tauri/tauri.conf.json`의 `bundle` 객체에 `resources` 키 추가(기존 `active`/`targets`/`icon` 유지):
```json
    "resources": {
      "ollama-runtime": "ollama-runtime"
    }
```
(source `src-tauri/ollama-runtime` → 리소스 루트의 `ollama-runtime/`로 구조 보존 복사. `lib/ollama` 하위 구조가 유지되어야 Windows ollama.exe가 상대경로로 lib을 찾을 수 있음. 구조 보존 여부는 Task 5 빌드에서 검증.)

- [ ] **Step 4: .gitignore 에 런타임 폴더 추가**

`.gitignore` 끝에 추가:
```
# 번들용 Ollama 런타임(용량 큼 — CI/스크립트가 채움)
src-tauri/ollama-runtime/
```

- [ ] **Step 5: 로컬 fetch 실행 + 검증**

Run:
```bash
cd /Users/sjpark/Documents/project/ai
chmod +x scripts/fetch-ollama.sh
bash scripts/fetch-ollama.sh
ls -la src-tauri/ollama-runtime/ollama
python3 -c "import json;json.load(open('src-tauri/tauri.conf.json'));print('tauri.conf.json OK')"
git status --porcelain | grep ollama-runtime && echo "ERROR: 런타임이 추적됨" || echo "런타임 미추적 OK"
```
Expected: `ollama-runtime/ollama` 존재, JSON 유효, 런타임 폴더는 git status에 안 뜸(gitignore 적용).

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add scripts/fetch-ollama.sh scripts/fetch-ollama.ps1 src-tauri/tauri.conf.json .gitignore
git commit -m "build: Ollama 런타임 번들 스크립트와 리소스 설정 추가

- 플랫폼별 fetch 스크립트(mac tgz, win zip+CUDA 제외) 추가
- tauri.conf bundle.resources에 ollama-runtime 포함
- 런타임 폴더는 gitignore 처리"
```

---

### Task 2: Rust — 관리형 ollama serve 프로세스 (ollama.rs)

**Files:**
- Create: `src-tauri/src/ollama.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `ollama::OLLAMA_PORT`(&str "11535"), `ollama::OllamaProcess`(관리형 상태), `ollama::start_server(&AppHandle)`, `ollama::stop_server(&AppHandle)`, `#[command] ollama::ollama_ready() -> bool`.
- Consumes: `ai.rs`가 이후 Task 3에서 `crate::ollama::OLLAMA_PORT` 사용.

- [ ] **Step 1: ollama.rs 작성**

`src-tauri/src/ollama.rs`:
```rust
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

// 공식 Ollama(11434)와 충돌 방지용 전용 포트
pub const OLLAMA_PORT: &str = "11535";

// 앱이 띄운 ollama serve 프로세스 핸들(종료 시 정리용)
#[derive(Default)]
pub struct OllamaProcess(pub Mutex<Option<Child>>);

// 번들된 ollama 실행 파일 경로(플랫폼별)
fn ollama_binary(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "windows")]
    let rel = "ollama-runtime/ollama.exe";
    #[cfg(not(target_os = "windows"))]
    let rel = "ollama-runtime/ollama";
    app.path()
        .resolve(rel, BaseDirectory::Resource)
        .map_err(|e| format!("ollama 경로 해석 실패: {e}"))
}

// 번들된 ollama serve 기동. 라이브러리 상대 로딩을 위해 런타임 폴더에서 실행.
pub fn start_server(app: &AppHandle) -> Result<(), String> {
    let bin = ollama_binary(app)?;
    let dir = bin
        .parent()
        .ok_or_else(|| "런타임 폴더를 찾을 수 없음".to_string())?
        .to_path_buf();

    let mut cmd = Command::new(&bin);
    cmd.arg("serve")
        .current_dir(&dir)
        .env("OLLAMA_HOST", format!("127.0.0.1:{OLLAMA_PORT}"));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: 콘솔 창 숨김
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("ollama serve 기동 실패: {e}"))?;
    *app.state::<OllamaProcess>().0.lock().unwrap() = Some(child);
    Ok(())
}

// 앱 종료 시 ollama serve 프로세스 정리
pub fn stop_server(app: &AppHandle) {
    if let Some(mut child) = app.state::<OllamaProcess>().0.lock().unwrap().take() {
        let _ = child.kill();
    }
}

// 런타임(ollama serve)이 응답 가능한지 확인
#[tauri::command]
pub async fn ollama_ready() -> bool {
    reqwest::Client::new()
        .get(format!("http://127.0.0.1:{OLLAMA_PORT}/api/tags"))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn 포트는_11535() {
        assert_eq!(OLLAMA_PORT, "11535");
    }
}
```

- [ ] **Step 2: lib.rs 에 모듈/상태/기동·종료 배선**

`src-tauri/src/lib.rs` 수정:

(a) 모듈 선언 추가(`mod ai;` 아래):
```rust
mod ai;
mod ollama;
```

(b) `tauri::Builder::default()` 체인에 상태 관리 추가(`.plugin(tauri_plugin_clipboard::init())` 다음 줄):
```rust
        .manage(ollama::OllamaProcess::default())
```

(c) `setup` 안에서 서버 기동(기존 `preload_model` spawn 앞):
```rust
        .setup(|app| {
            // 번들된 ollama serve 기동(전용 포트)
            if let Err(e) = ollama::start_server(app.handle()) {
                eprintln!("ollama 기동 실패: {e}");
            }
            // 앱 시작 시 모델 미리 로드(첫 생성 체감 속도 향상)
            tauri::async_runtime::spawn(async { let _ = ai::preload_model().await; });
```

(d) 트레이 "quit"에서 서버 정리 후 종료(기존 `app.exit(0);` 주석 교체):
```rust
                    "quit" => {
                        ollama::stop_server(app); // 번들 ollama serve 종료
                        app.exit(0);
                    }
```

(e) `invoke_handler`에 `ollama_ready` 추가:
```rust
        .invoke_handler(tauri::generate_handler![
            greet,
            ai::generate_notice,
            ai::refine_notice,
            ai::generate_notice_stream,
            ai::refine_notice_stream,
            ollama::ollama_ready
        ])
```

(f) 앱 완전 종료 시에도 정리되도록 `run` 콜백 추가. 기존:
```rust
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
```
을 아래로 교체:
```rust
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                ollama::stop_server(app);
            }
        });
```

- [ ] **Step 3: 빌드 + 테스트**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri && source "$HOME/.cargo/env" && cargo build && cargo test ollama
```
Expected: 컴파일 성공, `포트는_11535` 테스트 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/src/ollama.rs src-tauri/src/lib.rs
git commit -m "feat: 번들된 ollama serve 자동 기동/종료

- ollama.rs 추가: 리소스 경로의 ollama를 전용 포트(11535)로 spawn
- 앱 종료(quit/ExitRequested) 시 프로세스 정리
- ollama_ready 커맨드로 런타임 준비 상태 확인"
```

---

### Task 3: Rust — 포트 전환 + 모델 상태/스트리밍 다운로드

**Files:**
- Modify: `src-tauri/src/ai.rs`
- Modify: `src-tauri/src/lib.rs` (invoke_handler)

**Interfaces:**
- Consumes: `crate::ollama::OLLAMA_PORT`.
- Produces: `#[command] ai::model_installed() -> bool`, `#[command] ai::pull_model(app) -> Result<(), String>`(이벤트 `model://progress`/`model://done`/`model://error` emit). 생성/스트리밍은 포트 11535로 이동.

- [ ] **Step 1: ai.rs URL 상수를 11535로 전환**

`src-tauri/src/ai.rs`에서 세 상수의 포트를 11535로 변경(호스트는 127.0.0.1로 통일):
```rust
const AI_URL: &str = "http://127.0.0.1:11535/v1/chat/completions";
```
```rust
const NATIVE_URL: &str = "http://127.0.0.1:11535/api/generate";
```
```rust
const NATIVE_CHAT_URL: &str = "http://127.0.0.1:11535/api/chat";
```
(`preload_model`/`unload_model`가 `NATIVE_URL`을 쓰면 함께 이동됨 — 별도 수정 불필요. 만약 이들이 별도 URL 리터럴을 갖고 있으면 동일하게 11535로 변경.)

- [ ] **Step 2: 모델 존재 판정 헬퍼 + 테스트(실패 확인)**

`src-tauri/src/ai.rs`에 모델명 상수와 순수 판정 헬퍼 + 테스트 추가:
```rust
// 번들 앱이 사용하는 기본 모델
pub const MODEL: &str = "gemma4:e4b";

// /api/tags 응답에서 MODEL 설치 여부 판정(순수 함수 — 테스트 용이)
fn has_model(tags: &serde_json::Value, model: &str) -> bool {
    tags.get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter().any(|m| {
                m.get("model").and_then(|v| v.as_str()) == Some(model)
                    || m.get("name").and_then(|v| v.as_str()) == Some(model)
            })
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod model_tests {
    use super::*;
    #[test]
    fn 태그에_모델있으면_true() {
        let j = serde_json::json!({"models":[{"model":"gemma4:e4b","name":"gemma4:e4b"}]});
        assert!(has_model(&j, "gemma4:e4b"));
    }
    #[test]
    fn 태그에_없으면_false() {
        let j = serde_json::json!({"models":[{"model":"llama3","name":"llama3"}]});
        assert!(!has_model(&j, "gemma4:e4b"));
    }
    #[test]
    fn models_없으면_false() {
        let j = serde_json::json!({});
        assert!(!has_model(&j, "gemma4:e4b"));
    }
}
```
Run: `cd src-tauri && source "$HOME/.cargo/env" && cargo test model_tests` → 최초엔 컴파일/PASS 확인(헬퍼가 이미 구현되어 있으므로 GREEN이어야 함. RED을 원하면 헬퍼를 나중 단계로 분리 가능하나 여기서는 헬퍼+테스트 동시 추가).

- [ ] **Step 3: model_installed / pull_model 커맨드 구현**

`src-tauri/src/ai.rs`에 추가(파일 상단에 `use tauri::Emitter;`가 이미 있으면 재사용, `AppHandle`도 기존 import 사용):
```rust
// 모델 설치 여부(전용 포트의 /api/tags 조회)
#[tauri::command]
pub async fn model_installed() -> bool {
    let url = format!("http://127.0.0.1:{}/api/tags", crate::ollama::OLLAMA_PORT);
    let Ok(resp) = reqwest::Client::new().get(&url).send().await else {
        return false;
    };
    let Ok(json) = resp.json::<serde_json::Value>().await else {
        return false;
    };
    has_model(&json, MODEL)
}

// 모델 스트리밍 다운로드. 진행률을 model://progress 이벤트로 emit.
#[tauri::command]
pub async fn pull_model(app: AppHandle) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{}/api/pull", crate::ollama::OLLAMA_PORT);
    let client = reqwest::Client::new();
    let mut resp = client
        .post(&url)
        .json(&serde_json::json!({ "model": MODEL, "stream": true }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let mut buf = String::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        buf.push_str(&String::from_utf8_lossy(&chunk));
        // NDJSON: 줄 단위 처리
        while let Some(pos) = buf.find('\n') {
            let line: String = buf.drain(..=pos).collect();
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else {
                continue;
            };
            if let Some(err) = v.get("error").and_then(|e| e.as_str()) {
                let _ = app.emit("model://error", err.to_string());
                return Err(err.to_string());
            }
            let status = v.get("status").and_then(|s| s.as_str()).unwrap_or("");
            let completed = v.get("completed").and_then(|c| c.as_u64()).unwrap_or(0);
            let total = v.get("total").and_then(|t| t.as_u64()).unwrap_or(0);
            let _ = app.emit(
                "model://progress",
                serde_json::json!({ "status": status, "completed": completed, "total": total }),
            );
            if status == "success" {
                let _ = app.emit("model://done", ());
            }
        }
    }
    Ok(())
}
```

- [ ] **Step 4: invoke_handler 에 커맨드 등록**

`src-tauri/src/lib.rs`의 `invoke_handler`에 두 커맨드 추가:
```rust
        .invoke_handler(tauri::generate_handler![
            greet,
            ai::generate_notice,
            ai::refine_notice,
            ai::generate_notice_stream,
            ai::refine_notice_stream,
            ollama::ollama_ready,
            ai::model_installed,
            ai::pull_model
        ])
```

- [ ] **Step 5: 빌드 + 테스트**

Run:
```bash
cd /Users/sjpark/Documents/project/ai/src-tauri && source "$HOME/.cargo/env" && cargo build && cargo test
```
Expected: 컴파일 성공, `model_tests` 3개 + `ollama` 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src-tauri/src/ai.rs src-tauri/src/lib.rs
git commit -m "feat: 모델 존재 확인과 스트리밍 다운로드 커맨드 추가

- ai.rs 엔드포인트를 전용 포트(11535)로 전환
- model_installed로 gemma4:e4b 설치 여부 확인
- pull_model로 /api/pull 스트리밍 다운로드 + 진행률 이벤트 emit"
```

---

### Task 4: 프론트 — 부트스트랩 화면 + 컴포저블

**Files:**
- Create: `src/composables/useBootstrap.ts`
- Create: `src/composables/useBootstrap.test.ts`
- Create: `src/views/BootstrapView.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: 커맨드 `ollama_ready`/`model_installed`/`pull_model`, 이벤트 `model://progress`/`model://done`/`model://error`.
- Produces: `useBootstrap()` → `{ state, startBootstrap }`. `state.phase`가 `"ready"`가 될 때까지 App이 BootstrapView를 표시.

- [ ] **Step 1: useBootstrap 테스트 작성(실패 확인)**

`src/composables/useBootstrap.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
const listeners: Record<string, (e: any) => void> = {};
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: any[]) => invokeMock(...a) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, cb: (e: any) => void) => {
    listeners[name] = cb;
    return Promise.resolve(() => {});
  },
}));

import { useBootstrap } from "./useBootstrap";

describe("useBootstrap", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    for (const k of Object.keys(listeners)) delete listeners[k];
  });

  it("모델이 이미 있으면 바로 ready", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "ollama_ready") return true;
      if (cmd === "model_installed") return true;
      return undefined;
    });
    const { state, startBootstrap } = useBootstrap();
    await startBootstrap();
    expect(state.phase).toBe("ready");
  });

  it("모델이 없으면 다운로드 후 ready, 진행률 계산", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "ollama_ready") return true;
      if (cmd === "model_installed") return false;
      if (cmd === "pull_model") {
        listeners["model://progress"]({ payload: { status: "pulling", completed: 5, total: 10 } });
        listeners["model://done"]({ payload: undefined });
        return undefined;
      }
      return undefined;
    });
    const { state, startBootstrap } = useBootstrap();
    await startBootstrap();
    expect(state.percent).toBe(100);
    expect(state.phase).toBe("ready");
  });
});
```
Run `npm test` → RED(useBootstrap 없음).

- [ ] **Step 2: useBootstrap 구현**

`src/composables/useBootstrap.ts`:
```ts
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type Phase = "starting" | "downloading" | "ready" | "error";

const state = reactive({
    phase: "starting" as Phase,
    percent: 0,
    statusText: "AI 런타임을 준비하는 중...",
    error: "",
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ollama serve가 응답할 때까지 대기(최대 60초)
const waitReady = async (): Promise<boolean> => {
    for (let i = 0; i < 60; i += 1) {
        if (await invoke<boolean>("ollama_ready")) {
            return true;
        }
        await sleep(1000);
    }
    return false;
};

// 모델 스트리밍 다운로드 + 진행률 반영
const runPull = async (): Promise<void> => {
    state.phase = "downloading";
    state.percent = 0;
    state.statusText = "AI 모델 다운로드 중...";

    const unProgress = await listen<{ status: string; completed: number; total: number }>(
        "model://progress",
        (e) => {
            const { status, completed, total } = e.payload;
            if (total > 0) {
                state.percent = Math.floor((completed / total) * 100);
            }
            if (status) {
                state.statusText = total > 0 ? `${status} (${state.percent}%)` : status;
            }
        },
    );
    const unDone = await listen("model://done", () => {
        state.percent = 100;
    });
    const unError = await listen<string>("model://error", (e) => {
        state.phase = "error";
        state.error = e.payload;
    });

    try {
        await invoke("pull_model");
    } catch (err) {
        state.phase = "error";
        state.error = String(err);
    } finally {
        unProgress();
        unDone();
        unError();
    }
};

// 부트스트랩: 런타임 대기 → 모델 확인 → 없으면 다운로드 → ready
export const startBootstrap = async (): Promise<void> => {
    state.phase = "starting";
    state.error = "";
    state.statusText = "AI 런타임을 준비하는 중...";

    if (!(await waitReady())) {
        state.phase = "error";
        state.error = "AI 런타임을 시작하지 못했습니다.";
        return;
    }
    const installed = await invoke<boolean>("model_installed");
    if (!installed) {
        await runPull();
    }
    if (state.phase !== "error") {
        state.phase = "ready";
    }
};

export const useBootstrap = () => ({ state, startBootstrap });
```
Run `npm test` → GREEN.

- [ ] **Step 3: BootstrapView 작성**

`src/views/BootstrapView.vue`:
```vue
<template>
    <div class="bootstrap">
        <!-- 준비/다운로드 상태 -->
        <div v-if="state.phase !== 'error'" class="bootstrap-inner">
            <div class="spinner"></div>
            <p class="status">{{ state.statusText }}</p>
            <!-- 다운로드 진행률 바 -->
            <div v-if="state.phase === 'downloading'" class="bar">
                <div class="bar-fill" :style="{ width: state.percent + '%' }"></div>
            </div>
            <p v-if="state.phase === 'downloading'" class="hint">
                최초 1회만 받으며, 이후에는 오프라인으로 동작합니다.
            </p>
        </div>
        <!-- 오류 + 재시도 -->
        <div v-else class="bootstrap-error">
            <p class="err-msg">{{ state.error }}</p>
            <button class="retry-btn" @click="retry">다시 시도</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useBootstrap } from "@/composables/useBootstrap";

const { state, startBootstrap } = useBootstrap();

const retry = () => startBootstrap();
</script>

<style scoped>
.bootstrap {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 24px;
}
.bootstrap-inner,
.bootstrap-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
    max-width: 360px;
}
.spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border, #ccc);
    border-top-color: var(--accent, #4b7bec);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
.status {
    font-size: 14px;
}
.bar {
    width: 260px;
    height: 8px;
    background: var(--border, #e0e0e0);
    border-radius: 4px;
    overflow: hidden;
}
.bar-fill {
    height: 100%;
    background: var(--accent, #4b7bec);
    transition: width 0.2s ease;
}
.hint {
    font-size: 12px;
    opacity: 0.7;
}
.err-msg {
    font-size: 14px;
    color: #e74c3c;
}
.retry-btn {
    padding: 8px 18px;
    border: none;
    border-radius: 6px;
    background: var(--accent, #4b7bec);
    color: #fff;
    cursor: pointer;
}
</style>
```
(`--accent`/`--border`/`--fg` 등 실제 사용되는 테마 CSS 변수명은 기존 `src/assets` 또는 App 스타일을 확인해 일치시킬 것. 없으면 위 fallback 값 유지.)

- [ ] **Step 4: App.vue 에 부트스트랩 게이트 추가**

`src/App.vue` 수정:

(a) `<script setup>`에 import + 시작 호출(setup 최상위에서 직접 호출 — onMounted 금지):
```ts
import BootstrapView from "@/views/BootstrapView.vue";
import { useBootstrap } from "@/composables/useBootstrap";

const { state: bootstrap, startBootstrap } = useBootstrap();
startBootstrap();
```
(b) 템플릿을 부트스트랩 게이트로 감싼다. 기존 최상위 컨테이너 내부에서, 준비 완료 전에는 BootstrapView만, 준비되면 기존 내용(테마 토글·탭·뷰)을 표시:
```vue
        <!-- AI 런타임/모델 준비 화면 -->
        <BootstrapView v-if="bootstrap.phase !== 'ready'" />
        <!-- 준비 완료 후 기존 앱 -->
        <template v-else>
            <!-- 기존 테마 토글 + nav.tabs + v-show 뷰들 그대로 -->
        </template>
```
(기존 템플릿의 테마 토글/탭/뷰 마크업을 `<template v-else>` 안으로 이동. `useClipboardWatch`/`initTheme` 호출은 기존대로 script에 유지 — 준비 전에도 클립보드 감시는 무방.)

- [ ] **Step 5: 테스트 + 빌드**

Run:
```bash
cd /Users/sjpark/Documents/project/ai && npm test && npm run build
```
Expected: `useBootstrap` 테스트 포함 전부 PASS, 빌드 green.

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add src/composables/useBootstrap.ts src/composables/useBootstrap.test.ts src/views/BootstrapView.vue src/App.vue
git commit -m "feat: 첫 실행 부트스트랩 화면 추가

- useBootstrap: 런타임 대기→모델 확인→없으면 스트리밍 다운로드→ready
- BootstrapView: 스피너/진행률 바/오류 재시도 UI
- App이 준비 완료 전까지 부트스트랩 화면 표시"
```

---

### Task 5: CI — 플랫폼별 런타임 번들 + 릴리스 안내 + 버전업

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `src-tauri/tauri.conf.json` (version)
- Modify: `package.json` (version)
- Modify: `src-tauri/Cargo.toml` (version)
- Create: `README.md` (없으면 생성, 있으면 안내 갱신)

**Interfaces:**
- Produces: 태그 push 시 런타임이 번들된 Mac/Win 설치파일을 릴리스(draft)에 첨부.

- [ ] **Step 1: release.yml 에 런타임 fetch 스텝 추가**

`.github/workflows/release.yml`의 "Install frontend deps" 스텝 다음, "Build app & publish release" 스텝 앞에 추가:
```yaml
      - name: Fetch Ollama runtime (macOS)
        if: matrix.platform == 'macos-latest'
        run: bash scripts/fetch-ollama.sh

      - name: Fetch Ollama runtime (Windows)
        if: matrix.platform == 'windows-latest'
        shell: pwsh
        run: ./scripts/fetch-ollama.ps1
```

- [ ] **Step 2: 릴리스 안내문 갱신(Ollama 수동 설치 문구 제거)**

같은 파일 `releaseBody`를 아래로 교체:
```yaml
          releaseBody: |
            아래 Assets에서 설치파일을 받으세요.
            - macOS: `.dmg`
            - Windows: `.msi` 또는 `.exe`

            별도 설치 없이 바로 사용할 수 있습니다. 최초 1회 실행 시 AI 모델(약 9.6GB)을 자동 다운로드하며, 이후에는 오프라인으로 동작합니다.
```

- [ ] **Step 3: 버전 0.12.0 으로 상향**

- `src-tauri/tauri.conf.json`의 `"version"`을 `"0.12.0"`으로.
- `package.json`의 `"version"`을 `"0.12.0"`으로.
- `src-tauri/Cargo.toml`의 `[package] version`을 `"0.12.0"`으로.
(세 파일 버전 값 일치 확인.)

- [ ] **Step 4: README 안내 작성/갱신**

`README.md`(없으면 생성)에 사용자/개발 안내 추가:
```markdown
# AI 공지 도우미

복사한 메시지로 회사 공지를 자동 생성하는 데스크톱 앱(로컬 AI).

## 설치 후 사용
1. [Releases](../../releases)에서 OS에 맞는 설치파일(`.dmg`/`.msi`/`.exe`)을 받아 설치.
2. 실행하면 최초 1회 AI 모델(약 9.6GB)을 자동 다운로드합니다(진행률 표시). 완료 후 바로 사용.
3. 이후에는 인터넷 없이 오프라인으로 동작합니다.

> Ollama 런타임이 앱에 내장되어 있어 별도 설치가 필요 없습니다.

## 개발
```bash
npm ci
bash scripts/fetch-ollama.sh   # (Windows는 scripts/fetch-ollama.ps1) 로컬 실행에 필요한 ollama 런타임 준비
npm run tauri dev
```
```

- [ ] **Step 5: 로컬 프로덕션 빌드로 번들 구조 검증(macOS)**

Run:
```bash
cd /Users/sjpark/Documents/project/ai && npm run tauri build -- --target universal-apple-darwin 2>&1 | tail -20
# 번들에 런타임이 구조 보존되어 들어갔는지 확인
find src-tauri/target/universal-apple-darwin/release/bundle -type d -name "ollama-runtime" | head
ls "$(find src-tauri/target/universal-apple-darwin/release/bundle -type d -name ollama-runtime | head -1)/ollama" 2>/dev/null && echo "런타임 번들 OK"
```
Expected: `.app`/`.dmg` 생성, 번들 내부에 `ollama-runtime/ollama` 존재. (구조가 평탄화되어 `lib/ollama`가 사라지면 tauri.conf `resources` 매핑을 하위 경로 명시 방식으로 교체 후 재검증.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/sjpark/Documents/project/ai
git add .github/workflows/release.yml src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml README.md
git commit -m "build: CI에서 Ollama 런타임 번들 + 0.12.0

- release.yml에 플랫폼별 런타임 fetch 스텝 추가
- 릴리스 안내를 자립형(자동 다운로드)으로 갱신
- 버전 0.12.0, README 사용/개발 안내 추가"
```

---

## 완료 기준 (Plan 13)

- 설치파일에 Ollama 런타임이 포함되어, 사용자가 Ollama를 따로 설치하지 않아도 앱이 자체 `ollama serve`(포트 11535)를 띄운다.
- 첫 실행 시 모델이 없으면 부트스트랩 화면에서 진행률과 함께 `gemma4:e4b`를 자동 다운로드하고, 완료되면 기존 공지 생성 화면으로 전환된다.
- 모델이 이미 있으면(또는 다운로드 완료 후) 재시작 시 즉시 준비 완료 상태가 된다.
- 앱 종료 시 번들 ollama 프로세스가 정리된다.
- `cargo test`/`npm test` 통과, `npm run build` 그린, macOS 프로덕션 빌드에 런타임이 구조 보존되어 번들된다.
- CI 태그 push(v0.12.0) 시 런타임이 포함된 Mac/Win 설치파일이 릴리스에 첨부된다.

## 검증 한계(사용자 고지 필요)

- 개발 환경이 macOS라 **Mac 빌드는 로컬에서 실제 구동까지 검증 가능**하나, **Windows 빌드는 CI 빌드 성공 여부까지만 확인 가능**(실제 Windows 구동은 사용자 확인 필요).

## 다음 (선택, 범위 아님)

- 기존 공식 Ollama(11434)가 이미 모델을 갖고 있으면 재사용해 다운로드 생략.
- Windows에서도 앱 크래시 시 orphan ollama 프로세스 정리(작업 스케줄러/워치독).
