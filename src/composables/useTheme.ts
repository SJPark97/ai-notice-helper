import { ref } from "vue";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ai-notice:theme";

// 저장값 우선, 없으면 OS 선호(matchMedia 없으면 light)
const detectInitial = (): Theme => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
};

// 앱 전역 단일 테마 상태
const theme = ref<Theme>("light");

// 루트 엘리먼트에 data-theme 적용
const apply = (t: Theme): void => {
    document.documentElement.setAttribute("data-theme", t);
};

export function useTheme() {
    // 테마 지정(상태+저장+DOM)
    const setTheme = (t: Theme): void => {
        theme.value = t;
        localStorage.setItem(STORAGE_KEY, t);
        apply(t);
    };

    // 라이트↔다크 전환
    const toggleTheme = (): void => {
        setTheme(theme.value === "dark" ? "light" : "dark");
    };

    // 초기 적용(App 시작 시 1회)
    const initTheme = (): void => {
        theme.value = detectInitial();
        apply(theme.value);
    };

    return { theme, setTheme, toggleTheme, initTheme };
}
