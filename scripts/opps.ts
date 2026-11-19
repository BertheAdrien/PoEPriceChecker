import { findOpportunities, DEFAULT_ENGINE_CONFIG, type Opportunity } from "../src/lib/engine";
import { buildPriceIndex } from "../src/lib/prices";
import { loadRecipes } from "../src/lib/recipes";

function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 100) return String(Math.round(n));
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function line(o: Opportunity): string {
  const sign = o.profitChaos >= 0 ? "+" : "";
  const div = Math.abs(o.profitDivine) >= 1 ? ` (${sign}${fmt(o.profitDivine)}d)` : "";
  const liq = [
    o.liquidity.minVolumeChaos !== undefined ? `vol ${fmt(o.liquidity.minVolumeChaos)}c` : "",
    o.liquidity.minListings !== undefined ? `${o.liquidity.minListings} lst` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const flags = `${o.conditional ? " [cond]" : ""}${o.unverified ? " [?]" : ""}`;
  return `${sign}${fmt(o.marginPct)}% | ${sign}${fmt(o.profitChaos)}c${div} | coût ${fmt(o.costChaos)}c | ${o.kind} | ${o.label}${flags} | ${liq}`;
}

async function main() {
  const args = process.argv.slice(2);
  const top = Number(arg(args, "--top") ?? 20);
  const kind = arg(args, "--kind");
  const id = arg(args, "--id");
  const minMargin = arg(args, "--min-margin");
  const withConditional = args.includes("--conditional");

  const prices = await buildPriceIndex();
  const res = findOpportunities(prices, loadRecipes(), DEFAULT_ENGINE_CONFIG);

  let list = res.opportunities;
  if (!withConditional) list = list.filter((o) => !o.conditional);
  if (kind) list = list.filter((o) => o.kind === kind);
  if (id) list = list.filter((o) => o.id === id || o.id.includes(id));
  if (minMargin !== undefined) list = list.filter((o) => o.marginPct >= Number(minMargin));

  for (const o of list.slice(0, top)) {
    console.log(line(o));
    if (id) {
      for (const i of o.inputs) {
        console.log(`    achat  ${i.qty}× ${i.item} : ${fmt(i.unitChaos)}c (max ${fmt(i.maxBuyChaos ?? 0)}c)`);
      }
      for (const x of o.outputs) {
        console.log(`    vente  ${x.qty}× ${x.item} : ${fmt(x.unitChaos)}c (min ${fmt(x.minSellChaos ?? 0)}c)`);
      }
    }
  }
  if (list.length === 0) console.log("aucune opportunité");
  else if (list.length > top) console.log(`... +${list.length - top} autres`);

  const s = res.skipped;
  const c = res.chainSkipped;
  console.log(
    `# ${prices.league} | 1 div = ${fmt(prices.divineChaos)}c | ${list.length} opps | skips: ${s.missing_price} sans prix, ${s.illiquid} illiquides | chaînes: ${c.missing_price} sans prix, ${c.illiquid} illiquides | marge sécu ${DEFAULT_ENGINE_CONFIG.safetyMargin * 100}%`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
