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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
body {
    margin: 0;
}
</style>
