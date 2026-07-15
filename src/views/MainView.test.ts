import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import MainView from "./MainView.vue";
import { useClipboardMessages } from "../composables/useClipboardMessages";
import { useTemplates } from "../composables/useTemplates";

describe("MainView", () => {
  it("공지 유형 7종을 옵션으로 렌더한다", () => {
    const wrapper = mount(MainView);
    const options = wrapper.findAll('[data-test="notice-type"] option');
    expect(options).toHaveLength(7);
    expect(options[0].text()).toBe("일반");
  });

  it("공지 생성 버튼이 있다", () => {
    const wrapper = mount(MainView);
    expect(wrapper.find('[data-test="generate-btn"]').exists()).toBe(true);
  });
});

describe("MainView 클립보드 리스트", () => {
  const cb = useClipboardMessages();
  beforeEach(() => cb.clear());

  it("복사된 메시지를 리스트 항목으로 렌더한다", async () => {
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

describe("MainView 템플릿", () => {
  const tpl = useTemplates();
  beforeEach(() => {
    tpl.state.templates.splice(0);
    localStorage.clear();
  });

  it("이름 입력 후 저장하면 템플릿이 추가된다", async () => {
    const wrapper = mount(MainView);
    await wrapper.find('[data-test="tpl-name"]').setValue("내 배포 템플릿");
    await wrapper.find('[data-test="tpl-save"]').trigger("click");
    expect(tpl.state.templates).toHaveLength(1);
    expect(tpl.state.templates[0].name).toBe("내 배포 템플릿");
  });

  it("저장된 템플릿을 선택하면 유형이 폼에 반영된다", async () => {
    tpl.saveTemplate("장애템플릿", { type: "장애", language: "한국어", requirement: "영향범위 강조" });
    const wrapper = mount(MainView);
    const id = tpl.state.templates[0].id;
    await wrapper.find('[data-test="tpl-select"]').setValue(id);
    const typeSelect = wrapper.find('[data-test="notice-type"]').element as HTMLSelectElement;
    expect(typeSelect.value).toBe("장애");
  });
});
