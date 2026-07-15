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
