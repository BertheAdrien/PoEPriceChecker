"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Opportunity } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import { isFoulborn } from "@/lib/trade/query";
import type { VerifyResult } from "@/lib/trade/types";

export type VerifyState =
  | { status: "loading" }
  | { status: "done"; result: VerifyResult }
  | { status: "error"; message: string };

/** Au moins un item du stash (lien trade connu) hors Foulborn : vérifiable sur le trade. */
export function isVerifiable(o: Opportunity, payload: DashboardPayload): boolean {
  return [...o.inputs, ...o.outputs].some((i) => payload.trade[i.item] && !isFoulborn(i.item));
}

export const AUTO_VERIFY_COUNT = 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Vérifications trade, une à la fois (file séquentielle, jamais en parallèle). `autoIds` = ids à
 * vérifier automatiquement (dans l'ordre) ; `verify(id)` ajoute une vérification manuelle.
 */
export function useTradeVerification(autoIds: string[]) {
  const [states, setStates] = useState<Record<string, VerifyState>>({});
  const chain = useRef<Promise<void>>(Promise.resolve());
  const wanted = useRef<Set<string>>(new Set());
  const queued = useRef<Set<string>>(new Set());

  const enqueue = useCallback((id: string, manual: boolean) => {
    const setState = (s: VerifyState | undefined) =>
      setStates((prev) => {
        const next = { ...prev };
        if (s) next[id] = s;
        else delete next[id];
        return next;
      });
    if (queued.current.has(id)) return;
    queued.current.add(id);
    setState({ status: "loading" });
    chain.current = chain.current.then(async () => {
      if (!manual && !wanted.current.has(id)) {
        queued.current.delete(id);
        setState(undefined);
        return;
      }
      try {
        const res = await fetch(`/api/verify?id=${encodeURIComponent(id)}`);
        if (res.status === 429) {
          const body = (await res.json().catch(() => ({}))) as { retryAfterSec?: number; error?: string };
          queued.current.delete(id);
          setState({ status: "error", message: body.error ?? "limite de débit du trade" });
          await sleep(Math.min(120, body.retryAfterSec ?? 60) * 1000);
          return;
        }
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setState({ status: "done", result: body as VerifyResult });
      } catch (e) {
        queued.current.delete(id);
        setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
      }
    });
  }, []);

  const key = autoIds.join("|");
  useEffect(() => {
    const ids = key ? key.split("|") : [];
    wanted.current = new Set(ids);
    for (const id of ids) enqueue(id, false);
  }, [key, enqueue]);

  const verify = useCallback((id: string) => enqueue(id, true), [enqueue]);
  return { states, verify };
}
