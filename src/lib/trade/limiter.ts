import { parseRateRules, parseRateState, parseRetryAfter, type RateRule } from "./headers";

/** Règles prudentes utilisées tant qu'aucune réponse n'a révélé la politique réelle. */
export const DEFAULT_RULES: RateRule[] = [
  { hits: 5, period: 10, penalty: 60 },
  { hits: 15, period: 60, penalty: 300 },
  { hits: 30, period: 300, penalty: 1800 },
];

export class RateLimitWaitError extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Limite de débit trade : réessayer dans ${Math.ceil(retryAfterSec)} s`);
    this.name = "RateLimitWaitError";
  }
}

export interface LimiterOptions {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Attente max acceptée avant de lever `RateLimitWaitError` (défaut 120 s). */
  maxWaitMs?: number;
  defaults?: RateRule[];
}

interface ResponseLike {
  status: number;
  headers: { get(name: string): string | null };
}

interface Policy {
  rules: RateRule[];
  hits: number[];
}

/**
 * Limiteur du trade GGG : sérialise toutes les requêtes (une à la fois) et n'utilise jamais plus de
 * `limite - 1` requêtes par fenêtre (une de marge sous chaque limite). Une politique par nom
 * (`search`, `fetch`) ; les règles sont apprises de `X-Rate-Limit-Ip`, l'état serveur de
 * `X-Rate-Limit-Ip-State`. Un 429 ou une restriction bloque tout jusqu'à `Retry-After` / la pénalité.
 */
export class TradeRateLimiter {
  private policies = new Map<string, Policy>();
  private blockedUntil = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxWaitMs: number;
  private readonly defaults: RateRule[];

  constructor(opts: LimiterOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxWaitMs = opts.maxWaitMs ?? 120_000;
    this.defaults = opts.defaults ?? DEFAULT_RULES;
  }

  /** Exécute `fn` (qui fait la requête HTTP) quand les limites le permettent, en série. */
  schedule<T extends ResponseLike>(policy: string, fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => this.exec(policy, fn));
    this.tail = run.catch(() => undefined);
    return run;
  }

  private policy(name: string): Policy {
    let p = this.policies.get(name);
    if (!p) {
      p = { rules: this.defaults, hits: [] };
      this.policies.set(name, p);
    }
    return p;
  }

  /** Ms à attendre avant de pouvoir émettre une requête sur cette politique (<= 0 : tout de suite). */
  private waitMs(p: Policy): number {
    const now = this.now();
    let wait = this.blockedUntil - now;
    const maxPeriod = Math.max(...p.rules.map((r) => r.period)) * 1000;
    p.hits = p.hits.filter((t) => now - t < maxPeriod);
    for (const r of p.rules) {
      const allowed = Math.max(1, r.hits - 1);
      const recent = p.hits.filter((t) => now - t < r.period * 1000);
      if (recent.length >= allowed) {
        wait = Math.max(wait, recent[recent.length - allowed] + r.period * 1000 - now + 25);
      }
    }
    return wait;
  }

  private async exec<T extends ResponseLike>(name: string, fn: () => Promise<T>): Promise<T> {
    const p = this.policy(name);
    for (;;) {
      const wait = this.waitMs(p);
      if (wait <= 0) break;
      if (wait > this.maxWaitMs) throw new RateLimitWaitError(wait / 1000);
      await this.sleep(wait);
    }
    p.hits.push(this.now());
    const res = await fn();
    this.observe(p, res);
    return res;
  }

  private observe(p: Policy, res: ResponseLike): void {
    const now = this.now();
    const rules = parseRateRules(res.headers.get("x-rate-limit-ip"));
    if (rules.length) p.rules = rules;

    for (const s of parseRateState(res.headers.get("x-rate-limit-ip-state"))) {
      const recent = p.hits.filter((t) => now - t < s.period * 1000).length;
      for (let i = recent; i < s.hits; i++) p.hits.push(now);
      if (s.restricted > 0) this.blockedUntil = Math.max(this.blockedUntil, now + s.restricted * 1000);
    }
    p.hits.sort((a, b) => a - b);

    if (res.status === 429) {
      const retry = parseRetryAfter(res.headers.get("retry-after"), now);
      const penalty = Math.max(0, ...p.rules.map((r) => r.penalty));
      this.blockedUntil = Math.max(this.blockedUntil, now + (retry ?? penalty) * 1000);
    }
  }
}
