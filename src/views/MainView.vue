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

        <!-- 템플릿 선택/저장 -->
        <label>템플릿</label>
        <div class="tpl-row">
            <select v-model="selectedTemplateId" data-test="tpl-select" @change="onSelectTemplate">
                <option value="">템플릿 선택…</option>
                <option v-for="t in tplState.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <input
                v-model="templateName"
                data-test="tpl-name"
                class="tpl-name"
                placeholder="새 템플릿 이름"
            />
            <button data-test="tpl-save" type="button" @click="onSaveTemplate">저장</button>
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
import { useTemplates } from "../composables/useTemplates";

const emit = defineEmits<{ (e: "generate"): void }>();

const { state, select, clear, setWatching } = useClipboardMessages();
const { state: tplState, saveTemplate, getTemplate } = useTemplates();

const type = ref<string>(NOTICE_TYPES[0]);
const language = ref<string>(LANGUAGES[0].value);
const requirement = ref<string>("");

// 템플릿 저장용 이름 입력
const templateName = ref<string>("");
// 선택된 템플릿 id
const selectedTemplateId = ref<string>("");

// 감시 토글 핸들러
const onToggleWatch = (e: Event): void => {
    setWatching((e.target as HTMLInputElement).checked);
};

// 현재 폼을 템플릿으로 저장
const onSaveTemplate = (): void => {
    const saved = saveTemplate(templateName.value, {
        type: type.value,
        language: language.value,
        requirement: requirement.value,
    });
    if (saved) templateName.value = "";
};

// 템플릿 선택 시 폼에 적용
const onSelectTemplate = (): void => {
    const t = getTemplate(selectedTemplateId.value);
    if (!t) return;
    type.value = t.type;
    language.value = t.language;
    requirement.value = t.requirement;
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
    gap: 12px;
    padding: 20px;
    max-width: 720px;
    margin: 0 auto;
}
h1 {
    font-size: 22px;
    margin: 0 0 4px;
}
label {
    font-weight: 600;
    font-size: 13px;
    color: var(--text);
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
    color: var(--muted);
}
.clear-btn {
    margin-left: auto;
    font-size: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
}
.msg-list {
    min-height: 96px;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.placeholder {
    color: var(--muted);
    margin: 8px 4px;
    font-size: 13px;
}
.msg-item {
    text-align: left;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--item-bg);
    color: var(--text);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
}
.msg-item:hover {
    border-color: var(--border);
}
.msg-item.selected {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 14%, var(--surface));
}
.tpl-row {
    display: flex;
    gap: 8px;
}
.tpl-name {
    flex: 1;
}
select,
input,
textarea {
    font: inherit;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
}
textarea {
    min-height: 64px;
    resize: vertical;
}
button[data-test="generate-btn"] {
    margin-top: 4px;
    padding: 11px;
    border: none;
    border-radius: 10px;
    background: var(--primary);
    color: var(--primary-text);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
}
button[data-test="generate-btn"]:hover {
    filter: brightness(1.05);
}
button[data-test="tpl-save"] {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    border-radius: 8px;
    padding: 8px 14px;
    cursor: pointer;
}
</style>
