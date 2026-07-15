import { describe, it, expect, beforeEach } from "vitest";
import { useHistory } from "./useHistory";

describe("useHistory", () => {
  const h = useHistory();
  beforeEach(() => {
    h.state.records.splice(0);
    localStorage.clear();
  });

  it("기록을 최신순으로 추가하고 저장한다", () => {
    h.addRecord("공지1", "한국어", 1200);
    h.addRecord("공지2", "한국어", 800);
    expect(h.state.records).toHaveLength(2);
    expect(h.state.records[0].notice).toBe("공지2");
    expect(h.state.records[0].responseMs).toBe(800);
    expect(JSON.parse(localStorage.getItem("ai-notice:history") as string)).toHaveLength(2);
  });

  it("빈 notice는 기록하지 않는다", () => {
    h.addRecord("   ", "한국어", 100);
    expect(h.state.records).toHaveLength(0);
  });

  it("최대 20건만 보관한다", () => {
    for (let i = 0; i < 25; i++) h.addRecord(`공지 ${i}`, "한국어", 100);
    expect(h.state.records).toHaveLength(20);
    expect(h.state.records[0].notice).toBe("공지 24");
  });

  it("getRecord로 조회하고 clearHistory로 비운다", () => {
    h.addRecord("찾을공지", "English", 500);
    const id = h.state.records[0].id;
    expect(h.getRecord(id)?.notice).toBe("찾을공지");
    h.clearHistory();
    expect(h.state.records).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("ai-notice:history") as string)).toHaveLength(0);
  });
});
