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

// 출력 형식 (문서 에디터 타겟이라 기본 plain)
export const FORMATS = [
    { value: "plain", label: "일반 텍스트" },
    { value: "markdown", label: "마크다운" },
    { value: "html", label: "HTML" },
] as const;
