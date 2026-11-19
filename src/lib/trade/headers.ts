/** Une fenêtre de limite : `hits` requêtes max par `period` s ; dépassement = blocage `penalty` s. */
export interface RateRule {
  hits: number;
  period: number;
  penalty: number;
}

/** État courant d'une fenêtre : `hits` déjà consommés ; `restricted` > 0 = secondes de blocage restantes. */
export interface RateState {
  hits: number;
  period: number;
  restricted: number;
}

function triples(header: string | null | undefined): Array<[number, number, number]> {
  if (!header) return [];
  const out: Array<[number, number, number]> = [];
  for (const part of header.split(",")) {
    const nums = part.trim().split(":").map(Number);
    if (nums.length !== 3 || nums.some((n) => !Number.isFinite(n) || n < 0)) continue;
    out.push([nums[0], nums[1], nums[2]]);
  }
  return out;
}

/** `X-Rate-Limit-Ip: 5:10:60,15:60:300` -> règles (les entrées mal formées sont ignorées). */
export function parseRateRules(header: string | null | undefined): RateRule[] {
  return triples(header)
    .filter(([hits, period]) => hits > 0 && period > 0)
    .map(([hits, period, penalty]) => ({ hits, period, penalty }));
}

/** `X-Rate-Limit-Ip-State: 1:10:0,3:60:0` -> hits courants par fenêtre. */
export function parseRateState(header: string | null | undefined): RateState[] {
  return triples(header).map(([hits, period, restricted]) => ({ hits, period, restricted }));
}

/** `Retry-After` en secondes (entier ou date HTTP) ; undefined si absent ou illisible. */
export function parseRetryAfter(value: string | null | undefined, nowMs = Date.now()): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return n;
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.max(0, (t - nowMs) / 1000) : undefined;
}
