import { describe, it, expect } from "vitest";
import { NOTICE_TYPES, LANGUAGES } from "./notice";

describe("공지 상수", () => {
  it("공지 유형이 7종, 순서 고정이다", () => {
    expect([...NOTICE_TYPES]).toEqual([
      "일반",
      "배포",
      "장애",
      "점검",
      "회의",
      "긴급",
      "기타",
    ]);
  });

  it("언어 옵션에 한국어가 포함된다", () => {
    const values = LANGUAGES.map((l) => l.value);
    expect(values).toContain("한국어");
  });
});
