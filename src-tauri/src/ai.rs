use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

// Ollama OpenAI 호환 엔드포인트 / 모델 (추후 llama-server로 교체 가능)
const AI_URL: &str = "http://localhost:11434/v1/chat/completions";
const MODEL: &str = "gemma4:e4b";

// 회사 공지 작성 규칙 (스펙 §9)
const SYSTEM_PROMPT: &str = "너는 회사 공지 작성 도우미다. 규칙: 핵심 내용만, 일정 우선, 영향 범위 명시, 작업 내용 정리, 담당자는 마지막, 존댓말, 불필요한 인삿말 제거, 가독성 높은 불릿 사용. 공지 유형은 내용에 맞게 스스로 판단한다. 반드시 지정된 언어로만 출력한다.";

#[derive(Serialize, Deserialize, Clone)]
struct Msg {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatReq {
    model: String,
    messages: Vec<Msg>,
    stream: bool,
    temperature: f32,
}

#[derive(Deserialize)]
struct Choice {
    message: Msg,
}

#[derive(Deserialize)]
struct ChatResp {
    choices: Vec<Choice>,
}

// 공통 호출부
async fn call_ai(messages: Vec<Msg>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = ChatReq {
        model: MODEL.to_string(),
        messages,
        stream: false,
        temperature: 0.4,
    };
    let resp = client
        .post(AI_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI 서버 연결 실패 (Ollama 실행 중인지 확인): {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AI 서버 오류: {}", resp.status()));
    }
    let data: ChatResp = resp
        .json()
        .await
        .map_err(|e| format!("AI 응답 파싱 실패: {e}"))?;
    data.choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "AI 응답이 비어 있습니다".to_string())
}

// 출력 형식별 지시문
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

// 전역 규칙 블록(비어 있으면 빈 문자열)
fn rules_block(global_rules: &str) -> String {
    let r = global_rules.trim();
    if r.is_empty() {
        String::new()
    } else {
        format!("전역 규칙(항상 적용):\n{r}\n\n")
    }
}

// 공지 생성: 원본 메시지 + 지시(프롬프트) + 언어
#[tauri::command]
pub async fn generate_notice(
    message: String,
    prompt: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<String, String> {
    let user = format!(
        "{rules}원본 메시지:\n{message}\n\n지시:\n{prompt}\n\n{fmt}\n출력 언어: {language}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    call_ai(messages).await
}

// AI 수정: 현재 공지 + 수정 지시
#[tauri::command]
pub async fn refine_notice(
    current: String,
    instruction: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<String, String> {
    let user = format!(
        "{rules}아래 공지를 다음 지시에 맞게 다시 작성해줘. 언어는 {language}로 유지.\n{fmt}\n\n[현재 공지]\n{current}\n\n[지시]\n{instruction}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    call_ai(messages).await
}

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

// Ollama 네이티브 채팅 스트리밍 엔드포인트
const NATIVE_CHAT_URL: &str = "http://localhost:11434/api/chat";

#[derive(Serialize)]
struct StreamReq<'a> {
    model: &'a str,
    messages: &'a [Msg],
    stream: bool,
}

#[derive(Deserialize)]
struct StreamMsg {
    content: String,
}

#[derive(Deserialize)]
struct StreamChunk {
    message: StreamMsg,
    done: bool,
}

// Ollama 스트리밍 응답을 줄 단위로 읽어 토큰을 이벤트로 emit
async fn stream_ai(app: &AppHandle, messages: Vec<Msg>) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = StreamReq { model: MODEL, messages: &messages, stream: true };
    let mut resp = client
        .post(NATIVE_CHAT_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI 서버 연결 실패 (Ollama 실행 중인지 확인): {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AI 서버 오류: {}", resp.status()));
    }
    let mut buf = String::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        buf.push_str(&String::from_utf8_lossy(&chunk));
        // 완성된 줄(개행)마다 파싱
        while let Some(nl) = buf.find('\n') {
            let line: String = buf.drain(..=nl).collect();
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(c) = serde_json::from_str::<StreamChunk>(line) {
                if !c.message.content.is_empty() {
                    let _ = app.emit("notice://token", c.message.content);
                }
                if c.done {
                    let _ = app.emit("notice://done", ());
                }
            }
        }
    }
    Ok(())
}

// 공지 생성(스트리밍)
#[tauri::command]
pub async fn generate_notice_stream(
    app: AppHandle,
    message: String,
    prompt: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<(), String> {
    let user = format!(
        "{rules}원본 메시지:\n{message}\n\n지시:\n{prompt}\n\n{fmt}\n출력 언어: {language}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    let r = stream_ai(&app, messages).await;
    if let Err(e) = &r {
        let _ = app.emit("notice://error", e.clone());
    }
    r
}

// AI 수정(스트리밍)
#[tauri::command]
pub async fn refine_notice_stream(
    app: AppHandle,
    current: String,
    instruction: String,
    language: String,
    format: String,
    global_rules: String,
) -> Result<(), String> {
    let user = format!(
        "{rules}아래 공지를 다음 지시에 맞게 다시 작성해줘. 언어는 {language}로 유지.\n{fmt}\n\n[현재 공지]\n{current}\n\n[지시]\n{instruction}",
        rules = rules_block(&global_rules),
        fmt = format_rule(&format),
    );
    let messages = vec![
        Msg { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
        Msg { role: "user".to_string(), content: user },
    ];
    let r = stream_ai(&app, messages).await;
    if let Err(e) = &r {
        let _ = app.emit("notice://error", e.clone());
    }
    r
}
