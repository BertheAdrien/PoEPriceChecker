import { describe, expect, it } from "vitest";
import type { VerifyResult } from "@/lib/trade/types";
import { tradeStatus } from "./verify";

const done = (verified: boolean) => ({ status: "done" as const, result: { verified } as VerifyResult });

describe("tradeStatus", () => {
  it("rien pour ce qui n'est pas vérifiable (currency, cartes…)", () => {
    expect(tradeStatus(undefined, false)).toBe("none");
    expect(tradeStatus(done(true), false)).toBe("none");
  });
  it("cycle de vérification", () => {
    expect(tradeStatus(undefined, true)).toBe("pending");
    expect(tradeStatus({ status: "loading" }, true)).toBe("checking");
    expect(tradeStatus(done(true), true)).toBe("verified");
    expect(tradeStatus(done(false), true)).toBe("no_data");
    expect(tradeStatus({ status: "error", message: "x" }, true)).toBe("error");
    expect(tradeStatus({ status: "unavailable", message: "x" }, true)).toBe("unavailable");
  });
});
