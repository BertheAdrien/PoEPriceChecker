/**
 * Blocage du trade officiel pour ce serveur : GGG répond 403 (« code 6 Forbidden ») aux requêtes
 * venant d'IP d'hébergeurs (constaté sur le VPS OVH le 2026-11-19, même avec un POESESSID). Au premier
 * 403, on cesse d'interroger le trade pendant `BLOCK_RETRY_MS` au lieu d'envoyer des requêtes vouées
 * à l'échec ; un nouvel essai a lieu ensuite (au cas où le blocage serait levé).
 */
export const BLOCK_RETRY_MS = 60 * 60 * 1000;

// Un seul état par processus (survit au rechargement à chaud en dev, comme le limiteur).
const g = globalThis as unknown as { __tradeBlockedUntil?: number };

export function markTradeBlocked(now = Date.now()): void {
  g.__tradeBlockedUntil = now + BLOCK_RETRY_MS;
}

export function isTradeBlocked(now = Date.now()): boolean {
  return g.__tradeBlockedUntil !== undefined && now < g.__tradeBlockedUntil;
}

export function clearTradeBlocked(): void {
  g.__tradeBlockedUntil = undefined;
}

export const TRADE_BLOCKED_MESSAGE =
  "le trade officiel refuse les requêtes de ce serveur (IP d'hébergeur) : utilise les liens trade ou l'appli en local";
