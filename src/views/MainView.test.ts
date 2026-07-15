import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import MainView from "./MainView.vue";
import { useClipboardMessages } from "../composables/useClipboardMessages";

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
