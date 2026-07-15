<template>
    <section class="result-view">
        <h1>생성된 공지</h1>

        <!-- 미리보기(후속 Plan에서 수정 가능/실데이터 연결) -->
        <textarea class="preview" data-test="preview" readonly placeholder="여기에 생성된 공지가 표시됩니다."></textarea>

        <div class="actions">
            <button data-test="regenerate-btn">다시 생성</button>
            <button data-test="refine-btn">AI 수정</button>
            <button data-test="copy-btn">복사</button>
            <button data-test="back-btn" @click="emitBack">← 뒤로</button>
        </div>
    </section>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: "back"): void }>();

const emitBack = () => {
    emit("back");
};
</script>

<style scoped>
.result-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
}
.preview {
    min-height: 240px;
}
.actions {
    display: flex;
    gap: 8px;
}
</style>
