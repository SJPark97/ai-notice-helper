<template>
    <section class="main-view">
        <h1>AI 공지 도우미</h1>

        <!-- 복사한 메시지 리스트 (후속 Plan에서 클립보드 연결) -->
        <div class="msg-list" data-test="msg-list">
            <p class="placeholder">복사한 메시지가 여기에 표시됩니다.</p>
        </div>

        <!-- 공지 유형 -->
        <label>공지 유형</label>
        <select v-model="type" data-test="notice-type">
            <option v-for="t in NOTICE_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>

        <!-- 출력 언어 -->
        <label>언어</label>
        <select v-model="language" data-test="language">
            <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">
                {{ l.label }}
            </option>
        </select>

        <!-- 추가 요구사항 -->
        <label>추가 요구사항</label>
        <textarea
            v-model="requirement"
            data-test="requirement"
            placeholder="예) 존댓말, 3줄 이내, 영향 범위 강조"
        ></textarea>

        <!-- 공지 생성 -->
        <button data-test="generate-btn" @click="emitGenerate">공지 생성</button>
    </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NOTICE_TYPES, LANGUAGES } from "../constants/notice";

const emit = defineEmits<{ (e: "generate"): void }>();

const type = ref<string>(NOTICE_TYPES[0]);
const language = ref<string>(LANGUAGES[0].value);
const requirement = ref<string>("");

// 현재 단계에서는 화면 전환만. 후속 Plan에서 실제 생성 연결.
const emitGenerate = () => {
    emit("generate");
};
</script>

<style scoped>
.main-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
}
.msg-list {
    min-height: 96px;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
}
.placeholder {
    color: #999;
    margin: 0;
}
</style>
