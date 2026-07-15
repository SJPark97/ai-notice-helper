<template>
  <section class="main-view">
    <h1>AI 공지 도우미</h1>

    <!-- 복사한 메시지 리스트 -->
    <div class="msg-header">
      <span>복사한 메시지</span>
      <label class="watch-toggle">
        <input type="checkbox" :checked="state.watching" data-test="watch-toggle" @change="onToggleWatch" />
        감시
      </label>
      <button class="clear-btn" data-test="clear-btn" @click="clear">전체 지우기</button>
    </div>
    <div class="msg-list" data-test="msg-list">
      <p v-if="state.messages.length === 0" class="placeholder">복사한 메시지가 여기에 표시됩니다.</p>
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

    <!-- 프롬프트 선택/편집 -->
    <label>프롬프트</label>
    <div class="prompt-head">
      <select v-model="selectedPromptId" data-test="prompt-select" @change="onSelectPrompt">
        <option value="">프롬프트 선택…</option>
        <option v-for="pr in promptState.prompts" :key="pr.id" :value="pr.id">{{ pr.title }}</option>
      </select>
      <button data-test="prompt-save" type="button" @click="onSavePrompt">저장</button>
      <button data-test="prompt-update" type="button" :disabled="!selectedPromptId" @click="onUpdatePrompt">수정</button>
      <button data-test="prompt-delete" type="button" :disabled="!selectedPromptId" @click="onDeletePrompt">삭제</button>
    </div>
    <input v-model="promptTitle" data-test="prompt-title" placeholder="프롬프트 제목" />
    <textarea
      v-model="promptContent"
      data-test="prompt-content"
      class="prompt-content"
      placeholder="AI에게 줄 지시 (예: 존댓말로 3줄 이내, 영향 범위 강조, 담당자 마지막)"
    ></textarea>

    <!-- 출력 언어 -->
    <label>언어</label>
    <select v-model="language" data-test="language">
      <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
    </select>

    <!-- 공지 생성 -->
    <button data-test="generate-btn" class="generate-btn" @click="emitGenerate">공지 생성</button>
    <p v-if="validationError" class="validation-error" data-test="validation-error">{{ validationError }}</p>

    <!-- 최근 생성 기록 -->
    <div v-if="historyState.records.length" class="history">
      <div class="history-head">
        <span>최근 기록</span>
        <button class="clear-btn" data-test="history-clear" @click="clearHistory">기록 지우기</button>
      </div>
      <button
        v-for="r in historyState.records"
        :key="r.id"
        type="button"
        class="history-item"
        data-test="history-item"
        @click="onSelectHistory(r.id)"
      >
        {{ historyPreview(r.notice) }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { LANGUAGES } from "../constants/notice";
import { useClipboardMessages } from "../composables/useClipboardMessages";
import { usePrompts } from "../composables/usePrompts";
import { useGeneration } from "../composables/useGeneration";
import { useHistory } from "../composables/useHistory";

const emit = defineEmits<{ (e: "generate"): void }>();

// 공유 클립보드 상태
const { state, select, clear, setWatching, selectedMessage } = useClipboardMessages();

// 생성 상태
const { generate, setResult, state: genState } = useGeneration();

// 최근 기록 상태
const { state: historyState, clearHistory } = useHistory();

// 검증 피드백
const validationError = ref<string>("");

// 프롬프트 상태
const { state: promptState, savePrompt, updatePrompt, deletePrompt, getPrompt } = usePrompts();

// 출력 언어
const language = ref<string>(LANGUAGES[0].value);

// 프롬프트 편집 상태
const selectedPromptId = ref<string>("");
const promptTitle = ref<string>("");
const promptContent = ref<string>("");

// 감시 토글
const onToggleWatch = (e: Event): void => {
  setWatching((e.target as HTMLInputElement).checked);
};

// 프롬프트 선택 → 제목/내용 로드
const onSelectPrompt = (): void => {
  const p = getPrompt(selectedPromptId.value);
  if (!p) return;
  promptTitle.value = p.title;
  promptContent.value = p.content;
};

// 현재 편집 내용을 새 프롬프트로 저장
const onSavePrompt = (): void => {
  const saved = savePrompt(promptTitle.value, promptContent.value);
  if (saved) selectedPromptId.value = saved.id;
};

// 선택된 프롬프트 수정
const onUpdatePrompt = (): void => {
  if (!selectedPromptId.value) return;
  updatePrompt(selectedPromptId.value, promptTitle.value, promptContent.value);
};

// 선택된 프롬프트 삭제
const onDeletePrompt = (): void => {
  if (!selectedPromptId.value) return;
  deletePrompt(selectedPromptId.value);
  selectedPromptId.value = "";
  promptTitle.value = "";
  promptContent.value = "";
};

// 공지 생성: 메시지 선택 검증 후 생성 트리거
const emitGenerate = (): void => {
  if (!selectedMessage.value) {
    validationError.value = "복사한 메시지를 먼저 선택해주세요.";
    return;
  }
  validationError.value = "";
  // 실제 생성 시작(비동기) 후 결과 화면으로 전환
  generate(selectedMessage.value.text, promptContent.value, language.value);
  emit("generate");
};

// 기록 항목 미리보기 (한 줄 80자)
const historyPreview = (notice: string): string => {
  const oneLine = notice.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
};

// 기록 클릭 → 결과 화면에 로드
const onSelectHistory = (id: string): void => {
  const rec = historyState.records.find((r) => r.id === id);
  if (!rec) return;
  setResult(rec.notice);
  genState.status = "success";
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
.prompt-head {
  display: flex;
  gap: 8px;
}
.prompt-head select {
  flex: 1;
}
.prompt-content {
  min-height: 80px;
  resize: vertical;
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
.prompt-head button {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.prompt-head button:disabled {
  opacity: 0.45;
  cursor: default;
}
.generate-btn {
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
.generate-btn:hover {
  filter: brightness(1.05);
}
.validation-error {
  margin: 0;
  color: #e5484d;
  font-size: 13px;
}
.history {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.history-head {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: 13px;
}
.history-head .clear-btn {
  margin-left: auto;
}
.history-item {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--item-bg);
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}
.history-item:hover {
  border-color: var(--primary);
}
</style>
