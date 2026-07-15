import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import MainView from "./MainView.vue";
import { useClipboardMessages } from "../composables/useClipboardMessages";
import { usePrompts } from "../composables/usePrompts";

describe("MainView", () => {
  it("공지 생성 버튼이 있다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="generate-btn"]').exists()).toBe(true);
  });

  it("공지 유형 드롭다운은 없다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="notice-type"]').exists()).toBe(false);
  });

  it("언어 드롭다운이 있다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="language"]').exists()).toBe(true);
  });
});

describe("MainView 클립보드 리스트", () => {
  const cb = useClipboardMessages();
  beforeEach(() => cb.clear());

  it("복사된 메시지를 리스트 항목으로 렌더한다", () => {
    cb.addMessage("배포 완료했습니다");
    const wrapper = mount(MainView);
    const items = wrapper.findAll('[data-test="msg-item"]');
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain("배포 완료했습니다");
  });

  it("메시지를 클릭하면 선택된다", async () => {
    cb.addMessage("골라봐");
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="msg-item"]').trigger("click");
    expect(cb.selectedMessage.value?.text).toBe("골라봐");
  });
});

describe("MainView 프롬프트", () => {
  const p = usePrompts();
  beforeEach(() => {
    p.state.prompts.splice(0);
    localStorage.clear();
  });

  it("제목+내용을 저장하면 프롬프트가 추가된다", async () => {
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="prompt-title"]').setValue("내 프롬프트");
    await wrapper.find('[data-test="prompt-content"]').setValue("존댓말로 3줄");
    await wrapper.find('[data-test="prompt-save"]').trigger("click");
    expect(p.state.prompts).toHaveLength(1);
    expect(p.state.prompts[0].title).toBe("내 프롬프트");
    expect(p.state.prompts[0].content).toBe("존댓말로 3줄");
  });

  it("프롬프트를 선택하면 제목/내용이 로드된다", async () => {
    p.savePrompt("장애", "영향범위 강조");
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="prompt-select"]').setValue(p.state.prompts[0].id);
    const title = wrapper.find('[data-test="prompt-title"]').element as HTMLInputElement;
    const content = wrapper.find('[data-test="prompt-content"]').element as HTMLTextAreaElement;
    expect(title.value).toBe("장애");
    expect(content.value).toBe("영향범위 강조");
  });

  it("선택 후 수정하면 프롬프트가 갱신된다", async () => {
    p.savePrompt("원본", "원본내용");
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="prompt-select"]').setValue(p.state.prompts[0].id);
    await wrapper.find('[data-test="prompt-title"]').setValue("수정본");
    await wrapper.find('[data-test="prompt-update"]').trigger("click");
    expect(p.state.prompts[0].title).toBe("수정본");
  });
});
