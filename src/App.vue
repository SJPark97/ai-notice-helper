<template>
    <button class="theme-toggle" type="button" data-test="theme-toggle" @click="toggleTheme">
        {{ theme === "dark" ? "☀️" : "🌙" }}
    </button>

    <!-- 상단 탭 -->
    <nav class="tabs">
        <button :class="{ active: tab === 'notice' }" data-test="tab-notice" @click="tab = 'notice'">공지 생성</button>
        <button :class="{ active: tab === 'rules' }" data-test="tab-rules" @click="tab = 'rules'">전역 규칙</button>
    </nav>

    <div v-show="tab === 'notice'">
        <MainView v-show="screen === 'main'" @generate="screen = 'result'" />
        <ResultView v-show="screen === 'result'" @back="screen = 'main'" />
    </div>
    <GlobalRulesView v-show="tab === 'rules'" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import MainView from "./views/MainView.vue";
import ResultView from "./views/ResultView.vue";
import GlobalRulesView from "./views/GlobalRulesView.vue";
import { useClipboardWatch } from "./composables/useClipboardWatch";
import { useTheme } from "./composables/useTheme";

// 앱 생애 동안 클립보드 감시 (1회)
useClipboardWatch();

// 테마 초기화 + 토글
const { theme, toggleTheme, initTheme } = useTheme();
initTheme();

// 상단 탭 상태 (notice | rules)
const tab = ref<"notice" | "rules">("notice");

// 현재 화면 상태 (main | result)
const screen = ref<"main" | "result">("main");
</script>

<style>
:root {
    --bg: #f7f8fa;
    --surface: #ffffff;
    --text: #1f2430;
    --muted: #8a90a0;
    --border: #e3e6ec;
    --item-bg: #f2f4f7;
    --primary: #3b82f6;
    --primary-text: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
}
/* 다크 팔레트 (믹스인) */
@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
        --bg: #1c1f26;
        --surface: #252a33;
        --text: #e7e9ee;
        --muted: #9aa1b1;
        --border: #363c47;
        --item-bg: #2d323c;
        --primary: #4c8dff;
        --primary-text: #ffffff;
    }
}
/* 수동 토글이 OS 설정을 이긴다 (Task 4의 data-theme) */
:root[data-theme="dark"] {
    --bg: #1c1f26;
    --surface: #252a33;
    --text: #e7e9ee;
    --muted: #9aa1b1;
    --border: #363c47;
    --item-bg: #2d323c;
    --primary: #4c8dff;
    --primary-text: #ffffff;
}
:root[data-theme="light"] {
    --bg: #f7f8fa;
    --surface: #ffffff;
    --text: #1f2430;
    --muted: #8a90a0;
    --border: #e3e6ec;
    --item-bg: #f2f4f7;
    --primary: #3b82f6;
    --primary-text: #ffffff;
}
* { box-sizing: border-box; }
body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
}
.theme-toggle {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 10;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 8px;
    width: 34px;
    height: 34px;
    font-size: 15px;
    cursor: pointer;
}
.tabs {
    display: flex;
    gap: 4px;
    padding: 10px 20px 0;
    max-width: 720px;
    margin: 0 auto;
}
.tabs button {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
}
.tabs button.active {
    color: var(--text);
    background: var(--surface);
    border-bottom: 2px solid var(--primary);
}
</style>
