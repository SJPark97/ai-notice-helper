use serde::{Deserialize, Serialize};

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

// 공지 생성: 원본 메시지 + 지시(프롬프트) + 언어
#[tauri::command]
pub async fn generate_notice(
    message: String,
    prompt: String,
    language: String,
) -> Result<String, String> {
    let user = format!(
        "원본 메시지:\n{message}\n\n지시:\n{prompt}\n\n출력 언어: {language}"
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
) -> Result<String, String> {
    let user = format!(
        "아래 공지를 다음 지시에 맞게 다시 작성해줘. 언어는 {language}로 유지.\n\n[현재 공지]\n{current}\n\n[지시]\n{instruction}"
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
