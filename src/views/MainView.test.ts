import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MainView from "./MainView.vue";

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
