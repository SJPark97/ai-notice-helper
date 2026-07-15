<template>
    <MainView v-if="screen === 'main'" @generate="screen = 'result'" />
    <ResultView v-else @back="screen = 'main'" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import MainView from "./views/MainView.vue";
import ResultView from "./views/ResultView.vue";
import { useClipboardWatch } from "./composables/useClipboardWatch";

// 앱 생애 동안 클립보드 감시 (1회)
useClipboardWatch();

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
</style>
