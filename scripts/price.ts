import { buildPriceIndex, type PriceEntry } from "../src/lib/prices";
import { getCurrentLeague } from "../src/lib/ninja";

function fmtNum(n: number): string {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function line(e: PriceEntry, divineChaos: number): string {
  const div = e.chaos > divineChaos ? ` (${fmtNum(e.chaos / divineChaos)} div)` : "";
  const liq =
    e.liquidityKind === "volumeChaos" ? `vol ${fmtNum(e.liquidity)}c` : `${e.liquidity} listings`;
  const trend =
    e.trendPct === undefined ? "n/a" : `${e.trendPct > 0 ? "+" : ""}${Math.round(e.trendPct)}%`;
  return `${e.name} | ${fmtNum(e.chaos)}c${div} | ${liq} | 7j ${trend} | ${e.category}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--league")) {
    console.log(await getCurrentLeague());
    return;
  }
  const si = args.indexOf("--search");
  const search = si >= 0;
  const query = (search ? args[si + 1] : args[0])?.trim();
  if (!query) {
    console.error('Usage : npm run price -- "<item>" | --search <texte> | --league');
    process.exitCode = 1;
    return;
  }
  const idx = await buildPriceIndex(undefined, { diskCache: true });
  console.log(`# ${idx.league} | 1 div = ${fmtNum(idx.divineChaos)}c | ${idx.fetchedAt.toISOString()}`);
  if (idx.failedCategories.length > 0) {
    console.log(`# catégories indisponibles : ${idx.failedCategories.join(", ")}`);
  }
  const q = query.toLowerCase();
  const partial = () => [...idx.entries.values()].filter((e) => e.name.toLowerCase().includes(q));
  const exact = search ? undefined : idx.get(query);
  const matches = exact ? [exact] : partial();
  if (matches.length === 0) {
    console.log("aucun résultat");
    return;
  }
  matches.sort((a, b) => b.chaos - a.chaos);
  for (const e of matches.slice(0, 20)) console.log(line(e, idx.divineChaos));
  if (matches.length > 20) console.log(`... +${matches.length - 20} autres`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
