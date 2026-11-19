import { describe, expect, it } from "vitest";
import { fmtAmount, fmtDiv, fmtSigned } from "./format";

describe("fmtDiv", () => {
  it("1 décimale, sans .0", () => {
    expect(fmtDiv(3.04)).toBe("3");
    expect(fmtDiv(2.16)).toBe("2.2");
    expect(fmtDiv(9.96)).toBe("10");
    expect(fmtDiv(-1.45)).toBe("-1.4");
    expect(fmtDiv(-0.04)).toBe("0");
  });
});

describe("montants en div à partir de 1 div", () => {
  it("coût et profit", () => {
    expect(fmtAmount(474, 219)).toEqual({ main: "2.2 div", sub: "474c" });
    expect(fmtAmount(657, 219)).toEqual({ main: "3 div", sub: "657c" });
    expect(fmtAmount(42.4, 219)).toEqual({ main: "42.4c" });
    expect(fmtSigned(1184, 219).main).toBe("+5.4 div");
  });
});
