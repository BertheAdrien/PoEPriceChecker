import { describe, expect, it } from "vitest";
import { parseRateRules, parseRateState, parseRetryAfter } from "./headers";

describe("en-têtes de limite", () => {
  it("parse X-Rate-Limit-Ip", () => {
    expect(parseRateRules("5:10:60,15:60:300,30:300:1800,600:21600:3600")).toEqual([
      { hits: 5, period: 10, penalty: 60 },
      { hits: 15, period: 60, penalty: 300 },
      { hits: 30, period: 300, penalty: 1800 },
      { hits: 600, period: 21600, penalty: 3600 },
    ]);
  });
  it("ignore les entrées mal formées ou absentes", () => {
    expect(parseRateRules("5:10,abc,0:10:5, 3:6:9 ")).toEqual([{ hits: 3, period: 6, penalty: 9 }]);
    expect(parseRateRules(null)).toEqual([]);
    expect(parseRateRules("")).toEqual([]);
  });
  it("parse l'état (hits courants, restriction)", () => {
    expect(parseRateState("1:10:0,3:60:25")).toEqual([
      { hits: 1, period: 10, restricted: 0 },
      { hits: 3, period: 60, restricted: 25 },
    ]);
  });
  it("Retry-After en secondes ou en date", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("pas une date")).toBeUndefined();
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:45 GMT", now)).toBe(45);
  });
});
