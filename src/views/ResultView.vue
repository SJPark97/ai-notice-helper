<template>
  <section class="result-view">
    <h1>생성된 공지</h1>

    <!-- 로딩: 스피너 + 진행바(백분율 불가 → indeterminate) -->
    <div v-if="state.status === 'loading'" class="loading" data-test="status-loading">
      <div class="loading-head">
        <span class="spinner" aria-hidden="true"></span>
        <span>AI가 공지를 생성 중입니다…</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-label="생성 진행 중"></div>
    </div>

    <!-- 에러 -->
    <div v-else-if="state.status === 'error'" class="status error" data-test="status-error">
      <p>{{ state.error }}</p>
      <button data-test="retry-btn" @click="regenerate">다시 시도</button>
    </div>

    <!-- 결과 -->
    <template v-else>
      <textarea
        class="preview"
        data-test="preview"
        :value="state.result"
        @input="onEdit"
        placeholder="여기에 생성된 공지가 표시됩니다."
      ></textarea>

      <!-- AI 수정 지시 -->
      <div class="refine-row">
        <input v-model="refineText" data-test="refine-input" placeholder="AI 수정 지시 (예: 더 짧게, 더 정중하게)" />
        <button data-test="refine-btn" @click="onRefine">AI 수정</button>
      </div>
    </template>

    <div class="actions">
      <button data-test="regenerate-btn" @click="regenerate">다시 생성</button>
      <button data-test="copy-btn" @click="onCopy">{{ copied ? "복사됨!" : "복사" }}</button>
      <button data-test="back-btn" @click="emitBack">← 뒤로</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useGeneration } from "../composables/useGeneration";

const emit = defineEmits<{ (e: "back"): void }>();

const { state, regenerate, refine, setResult } = useGeneration();

const refineText = ref<string>("");
const copied = ref<boolean>(false);

// 편집 반영
const onEdit = (e: Event): void => {
  setResult((e.target as HTMLTextAreaElement).value);
};

// AI 수정 실행
const onRefine = (): void => {
  const t = refineText.value.trim();
  if (!t) return;
  refine(t);
  refineText.value = "";
};

// 클립보드 복사
const onCopy = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(state.result);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // 실패 시 무시(브라우저 권한 등)
  }
};

const emitBack = (): void => {
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
.status {
  color: var(--muted);
  font-size: 14px;
}
.status.error {
  color: #e5484d;
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
.refine-row {
  display: flex;
  gap: 8px;
}
.refine-row input {
  flex: 1;
  font: inherit;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button,
.refine-row button,
.status button {
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.actions button:hover,
.refine-row button:hover {
  border-color: var(--primary);
}
.loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.loading-head {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 14px;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex: none;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress-bar {
  position: relative;
  height: 4px;
  width: 100%;
  background: var(--item-bg);
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 40%;
  background: var(--primary);
  border-radius: 2px;
  animation: indeterminate 1.2s ease-in-out infinite;
}
@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
</style>
