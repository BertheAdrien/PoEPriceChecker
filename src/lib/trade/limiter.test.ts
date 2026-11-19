import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitWaitError, TradeRateLimiter } from "./limiter";

const res = (headers: Record<string, string> = {}, status = 200) => new Response(null, { status, headers });

describe("TradeRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("reste une requête sous chaque limite (5:10 -> 4 par 10 s)", async () => {
    const lim = new TradeRateLimiter();
    const times: number[] = [];
    const run = () =>
      lim.schedule("search", async () => {
        times.push(Date.now());
        return res();
      });
    const all = Promise.all(Array.from({ length: 6 }, run));
    await vi.advanceTimersByTimeAsync(0);
    expect(times).toEqual([0, 0, 0, 0]);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(times).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(times).toHaveLength(6);
    expect(times[4]).toBeGreaterThanOrEqual(10_000);
    await all;
    for (const t of times) {
      expect(times.filter((x) => x >= t && x < t + 10_000).length).toBeLessThanOrEqual(4);
    }
  });

  it("sérialise : jamais deux requêtes en parallèle", async () => {
    const lim = new TradeRateLimiter();
    let active = 0;
    let max = 0;
    const run = () =>
      lim.schedule("fetch", async () => {
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 50));
        active--;
        return res();
      });
    const all = Promise.all([run(), run(), run()]);
    await vi.advanceTimersByTimeAsync(500);
    await all;
    expect(max).toBe(1);
  });

  it("apprend les règles des en-têtes (2:5 -> 1 requête par 5 s)", async () => {
    const lim = new TradeRateLimiter();
    const times: number[] = [];
    const run = () =>
      lim.schedule("search", async () => {
        times.push(Date.now());
        return res({ "x-rate-limit-ip": "2:5:30" });
      });
    const all = Promise.all([run(), run(), run()]);
    await vi.advanceTimersByTimeAsync(20_000);
    await all;
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(5_000);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(5_000);
  });

  it("tient compte de l'état serveur (hits déjà consommés)", async () => {
    const lim = new TradeRateLimiter();
    const times: number[] = [];
    await lim.schedule("search", async () => {
      times.push(Date.now());
      return res({ "x-rate-limit-ip": "5:10:60", "x-rate-limit-ip-state": "4:10:0" });
    });
    const second = lim.schedule("search", async () => {
      times.push(Date.now());
      return res();
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(times).toHaveLength(1); // 4 hits côté serveur = déjà au plafond (limite - 1)
    await vi.advanceTimersByTimeAsync(10_100);
    await second;
    expect(times[1]).toBeGreaterThanOrEqual(10_000);
  });

  it("429 : respecte Retry-After pour la requête suivante", async () => {
    const lim = new TradeRateLimiter();
    const times: number[] = [];
    await lim.schedule("search", async () => {
      times.push(Date.now());
      return res({ "retry-after": "40" }, 429);
    });
    const next = lim.schedule("fetch", async () => {
      times.push(Date.now());
      return res();
    });
    await vi.advanceTimersByTimeAsync(39_000);
    expect(times).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2_000);
    await next;
    expect(times[1]).toBeGreaterThanOrEqual(40_000);
  });

  it("restriction serveur : bloque pour la durée indiquée", async () => {
    const lim = new TradeRateLimiter();
    await lim.schedule("search", async () => res({ "x-rate-limit-ip-state": "1:10:20" }));
    const times: number[] = [];
    const next = lim.schedule("search", async () => {
      times.push(Date.now());
      return res();
    });
    await vi.advanceTimersByTimeAsync(19_000);
    expect(times).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2_000);
    await next;
    expect(times[0]).toBeGreaterThanOrEqual(20_000);
  });

  it("attente trop longue : erreur au lieu de bloquer", async () => {
    const lim = new TradeRateLimiter({ maxWaitMs: 5_000 });
    await lim.schedule("search", async () => res({ "retry-after": "60" }, 429));
    await expect(lim.schedule("search", async () => res())).rejects.toBeInstanceOf(RateLimitWaitError);
  });
});
