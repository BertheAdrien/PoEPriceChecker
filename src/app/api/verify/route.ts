import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_ENGINE_CONFIG, findOpportunities, type Opportunity } from "@/lib/engine";
import { buildPriceIndex, type PriceIndex } from "@/lib/prices";
import { loadRecipes } from "@/lib/recipes";
import { RateLimitWaitError, TradeRateLimitedError, verifyOpportunity } from "@/lib/trade";

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

/** GET /api/verify?id=<id d'opportunité> : vérifie une opportunité sur le trade officiel. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "paramètre id manquant" }, { status: 400 });
  try {
    const index = await buildPriceIndex();
    const o = opportunities(index).get(id);
    if (!o) return NextResponse.json({ error: `opportunité inconnue : ${id}` }, { status: 404 });
    return NextResponse.json(await verifyOpportunity(o, index, DEFAULT_ENGINE_CONFIG));
  } catch (e) {
    if (e instanceof TradeRateLimitedError || e instanceof RateLimitWaitError) {
      return NextResponse.json(
        { error: e.message, retryAfterSec: e.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(Math.ceil(e.retryAfterSec)) } },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
