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
import { useBootstrap } from "../composables/useBootstrap";

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
    border-top-color: var(--primary, #4b7bec);
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
    background: var(--primary, #4b7bec);
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
    background: var(--primary, #4b7bec);
    color: #fff;
    cursor: pointer;
}
</style>
