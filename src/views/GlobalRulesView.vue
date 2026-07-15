<template>
  <section class="rules-view">
    <h1>전역 규칙</h1>
    <p class="desc">모든 공지 생성에 항상 적용되는 규칙입니다. (프롬프트와 별개)</p>
    <textarea
      class="rules-input"
      data-test="global-rules"
      :value="state.rules"
      @input="onInput"
      placeholder="예) 회사명은 인투씨엔에스로 표기. 항상 존댓말. 담당자는 맨 마지막에 '문의: 이름'."
    ></textarea>
    <p class="saved" data-test="rules-saved">자동 저장됨</p>
  </section>
</template>

<script setup lang="ts">
import { useGlobalRules } from "../composables/useGlobalRules";

const { state, setRules } = useGlobalRules();

// 입력 즉시 저장
const onInput = (e: Event): void => {
  setRules((e.target as HTMLTextAreaElement).value);
};
</script>

<style scoped>
.rules-view {
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
.desc {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}
.rules-input {
  min-height: 300px;
  font: inherit;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  resize: vertical;
}
.saved {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
  align-self: flex-end;
}
</style>
