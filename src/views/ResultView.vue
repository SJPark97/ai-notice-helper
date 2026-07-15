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
    gap: 12px;
    padding: 20px;
    max-width: 720px;
    margin: 0 auto;
}
h1 {
    font-size: 22px;
    margin: 0;
}
.preview {
    min-height: 260px;
    font: inherit;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    resize: vertical;
}
.actions {
    display: flex;
    gap: 8px;
}
.actions button {
    padding: 9px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
}
.actions button:hover {
    border-color: var(--primary);
}
</style>
