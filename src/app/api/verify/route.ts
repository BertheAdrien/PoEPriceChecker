import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_ENGINE_CONFIG, findOpportunities, type Opportunity } from "@/lib/engine";
import { buildPriceIndex, type PriceIndex } from "@/lib/prices";
import { loadRecipes } from "@/lib/recipes";
import {
  isTradeBlocked,
  markTradeBlocked,
  RateLimitWaitError,
  TRADE_BLOCKED_MESSAGE,
  TradeApiError,
  TradeRateLimitedError,
  verifyOpportunity,
} from "@/lib/trade";

// opportunités par index de prix (l'index est mis en cache 15 min par buildPriceIndex)
const byIndex = new WeakMap<PriceIndex, Map<string, Opportunity>>();

function opportunities(index: PriceIndex): Map<string, Opportunity> {
  let m = byIndex.get(index);
  if (!m) {
    const res = findOpportunities(index, loadRecipes(), DEFAULT_ENGINE_CONFIG);
    m = new Map(res.opportunities.map((o) => [o.id, o]));
    byIndex.set(index, m);
  }
  return m;
}

/** 503 « trade indisponible » : le client cesse ses vérifications automatiques. */
const unavailable = () => NextResponse.json({ error: TRADE_BLOCKED_MESSAGE, unavailable: true }, { status: 503 });

/**
 * GET /api/verify?id=<id d'opportunité>[&fresh=1] : vérifie une opportunité sur le trade officiel.
 * `fresh=1` (bouton « Vérifier ») ignore le cache trade de 15 min ; toujours via le limiteur.
 * Trade bloqué pour ce serveur (403) : réponse 503 immédiate, sans interroger GGG (cf. `blocked.ts`).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  if (!id) return NextResponse.json({ error: "paramètre id manquant" }, { status: 400 });
  if (isTradeBlocked()) return unavailable();
  try {
    const index = await buildPriceIndex();
    const o = opportunities(index).get(id);
    if (!o) return NextResponse.json({ error: `opportunité inconnue : ${id}` }, { status: 404 });
    return NextResponse.json(await verifyOpportunity(o, index, DEFAULT_ENGINE_CONFIG, {}, fresh));
  } catch (e) {
    if (e instanceof TradeRateLimitedError || e instanceof RateLimitWaitError) {
      return NextResponse.json(
        { error: e.message, retryAfterSec: e.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(Math.ceil(e.retryAfterSec)) } },
      );
    }
    if (e instanceof TradeApiError && e.status === 403) {
      markTradeBlocked();
      return unavailable();
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
