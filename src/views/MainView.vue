<template>
    <section class="main-view">
        <h1>AI 공지 도우미</h1>

        <!-- 복사한 메시지 리스트 -->
        <div class="msg-header">
            <span>복사한 메시지</span>
            <label class="watch-toggle">
                <input type="checkbox" :checked="state.watching" data-test="watch-toggle"
                    @change="onToggleWatch" />
                감시
            </label>
            <button class="clear-btn" data-test="clear-btn" @click="clear">전체 지우기</button>
        </div>
        <div class="msg-list" data-test="msg-list">
            <p v-if="state.messages.length === 0" class="placeholder">
                복사한 메시지가 여기에 표시됩니다.
            </p>
            <button
                v-for="m in state.messages"
                :key="m.id"
                type="button"
                class="msg-item"
                :class="{ selected: m.id === state.selectedId }"
                data-test="msg-item"
                @click="select(m.id)"
            >
                {{ m.preview }}
            </button>
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
import { useClipboardMessages } from "../composables/useClipboardMessages";

const emit = defineEmits<{ (e: "generate"): void }>();

const { state, select, clear, setWatching } = useClipboardMessages();

const type = ref<string>(NOTICE_TYPES[0]);
const language = ref<string>(LANGUAGES[0].value);
const requirement = ref<string>("");

// 감시 토글 핸들러
const onToggleWatch = (e: Event): void => {
    setWatching((e.target as HTMLInputElement).checked);
};

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
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
}
.placeholder {
    color: #999;
    margin: 0;
}
.msg-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
}
.watch-toggle {
    font-weight: 400;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 4px;
}
.clear-btn {
    margin-left: auto;
    font-size: 12px;
}
.msg-item {
    text-align: left;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: #f6f6f6;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.msg-item.selected {
    border-color: #3b82f6;
    background: #e8f0fe;
}
</style>
