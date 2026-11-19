"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Opportunity } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import { isFoulborn } from "@/lib/trade/query";
import type { VerifyResult } from "@/lib/trade/types";
import { readSession, writeSession } from "./session";

export type VerifyState =
  | { status: "loading" }
  | { status: "done"; result: VerifyResult }
  | { status: "error"; message: string }
  /** Le trade refuse les requêtes de ce serveur (403, cf. `src/lib/trade/blocked.ts`). */
  | { status: "unavailable"; message: string };

/** Au moins un item du stash (lien trade connu) hors Foulborn : vérifiable sur le trade. */
export function isVerifiable(o: Opportunity, payload: Pick<DashboardPayload, "trade">): boolean {
  return [...o.inputs, ...o.outputs].some((i) => payload.trade[i.item] && !isFoulborn(i.item));
}

export const AUTO_VERIFY_COUNT = 10;

/** État de vérification affiché en cartouche ; "none" = rien à vérifier (currency, cartes…). */
export type TradeStatus = "none" | "pending" | "checking" | "verified" | "no_data" | "error" | "unavailable";

export function tradeStatus(v: VerifyState | undefined, verifiable: boolean): TradeStatus {
  if (!verifiable) return "none";
  if (!v) return "pending";
  if (v.status === "loading") return "checking";
  if (v.status === "error") return "error";
  if (v.status === "unavailable") return "unavailable";
  return v.result.verified ? "verified" : "no_data";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Vérifications trade, une à la fois (file séquentielle, jamais en parallèle). `autoIds` = ids à
 * vérifier automatiquement (dans l'ordre) ; `verify(id)` ajoute une vérification manuelle.
 * Les résultats sont partagés entre les pages de l'onglet (sessionStorage), tant que les données
 * poe.ninja (`fetchedAt`) sont les mêmes.
 */
export function useTradeVerification(autoIds: string[], fetchedAt: string) {
  const [states, setStates] = useState<Record<string, VerifyState>>({});
  const chain = useRef<Promise<void>>(Promise.resolve());
  const wanted = useRef<Set<string>>(new Set());
  /** Ids déjà mis en file ou vérifiés : pas de nouvelle vérification automatique. */
  const queued = useRef<Set<string>>(new Set());
  /** Ids en file ou en cours : pas de doublon, même manuel. */
  const inflight = useRef<Set<string>>(new Set());
  /** Trade indisponible pour ce serveur (réponse 503) : plus de vérification automatique dans la page. */
  const blocked = useRef<string | null>(null);
  const fetchedAtRef = useRef(fetchedAt);
  useEffect(() => {
    fetchedAtRef.current = fetchedAt;
  }, [fetchedAt]);

  const enqueue = useCallback((id: string, manual: boolean) => {
    const setState = (s: VerifyState | undefined) =>
      setStates((prev) => {
        const next = { ...prev };
        if (s) next[id] = s;
        else delete next[id];
        return next;
      });
    // Manuel (bouton) : revérifie même un item déjà vérifié (prix trade rafraîchi), sauf s'il est déjà en file.
    if (inflight.current.has(id) || (!manual && queued.current.has(id))) return;
    queued.current.add(id);
    inflight.current.add(id);
    setState({ status: "loading" });
    chain.current = chain.current.then(async () => {
      if (!manual && !wanted.current.has(id)) {
        queued.current.delete(id);
        inflight.current.delete(id);
        setState(undefined);
        return;
      }
      if (!manual && blocked.current !== null) {
        queued.current.delete(id);
        inflight.current.delete(id);
        setState({ status: "unavailable", message: blocked.current });
        return;
      }
      try {
        const res = await fetch(`/api/verify?id=${encodeURIComponent(id)}${manual ? "&fresh=1" : ""}`);
        if (res.status === 503) {
          const body = (await res.json().catch(() => ({}))) as { unavailable?: boolean; error?: string };
          if (body.unavailable) {
            const message = body.error ?? "trade indisponible depuis ce serveur";
            blocked.current = message;
            queued.current.delete(id);
            setState({ status: "unavailable", message });
            return;
          }
        }
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
        // Écrit directement (et non via l'état) : le résultat est conservé même si la page a été quittée.
        const fa = fetchedAtRef.current;
        writeSession("verifications", { ...readSession<Record<string, VerifyResult>>("verifications", fa), [id]: body }, fa);
      } catch (e) {
        queued.current.delete(id);
        setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        inflight.current.delete(id);
      }
    });
  }, []);

  // Restaure les vérifications déjà faites (avant l'effet des autoIds : elles ne sont pas refaites).
  // Rejoué quand la page redevient visible (Next garde le tableau monté mais masqué pendant la visite
  // d'une liste de courses) : un résultat obtenu entre-temps sur une autre page remplace un échec ou un
  // résultat plus ancien affiché ici. Seule une vérification en cours est laissée telle quelle.
  useEffect(() => {
    const saved = readSession<Record<string, VerifyResult>>("verifications", fetchedAt) ?? {};
    for (const id of Object.keys(saved)) queued.current.add(id);
    if (Object.keys(saved).length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage n'existe qu'après l'hydratation
    setStates((prev) => {
      const next = { ...prev };
      for (const [id, result] of Object.entries(saved)) {
        if (next[id]?.status !== "loading") next[id] = { status: "done", result };
      }
      return next;
    });
  }, [fetchedAt]);

  const key = autoIds.join("|");
  useEffect(() => {
    const ids = key ? key.split("|") : [];
    wanted.current = new Set(ids);
    for (const id of ids) enqueue(id, false);
    // Page quittée ou autre sélection : les vérifications automatiques encore en file sont abandonnées.
    return () => {
      wanted.current = new Set();
    };
  }, [key, enqueue]);

  const verify = useCallback((id: string) => enqueue(id, true), [enqueue]);
  return { states, verify };
}
