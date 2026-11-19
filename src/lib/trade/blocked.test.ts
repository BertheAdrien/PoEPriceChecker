import { beforeEach, describe, expect, it } from "vitest";
import { BLOCK_RETRY_MS, clearTradeBlocked, isTradeBlocked, markTradeBlocked } from "./blocked";

describe("blocage du trade (403)", () => {
  beforeEach(() => clearTradeBlocked());

  it("pas bloqué par défaut", () => {
    expect(isTradeBlocked(0)).toBe(false);
  });
  it("bloqué pendant BLOCK_RETRY_MS après un 403, puis nouvel essai", () => {
    markTradeBlocked(1000);
    expect(isTradeBlocked(1000)).toBe(true);
    expect(isTradeBlocked(1000 + BLOCK_RETRY_MS - 1)).toBe(true);
    expect(isTradeBlocked(1000 + BLOCK_RETRY_MS)).toBe(false);
  });
});
