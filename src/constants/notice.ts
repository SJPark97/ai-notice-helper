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
