---
paths:
  - "src/lib/engine/**"
---

# Règles du moteur d'arbitrage
- Fonctions **pures** : prix et recettes en entrée, opportunités en sortie. Aucun fetch, aucun accès disque.
- Toute modification = un test Vitest à côté (`*.test.ts`) avec des prix fixes écrits à la main.
- Coût = somme des entrées au prix d'**achat** ; revenu = sorties au prix de **vente**. poe.ninja ne donne
  qu'une valeur par item → appliquer `safetyMargin` (config) au revenu.
- Une opportunité expose toujours : `marginPct`, `profitChaos`, `liquidity` (min des liquidités des items concernés),
  `trend` (sparkline), `steps` (pour les chaînes), `sources`.
- Un item sans prix ou à faible liquidité (sous `minLiquidity`) → recette ignorée, jamais un prix à 0.
- Uniques à variantes ou liens multiples : prendre la ligne non liée la **moins chère** (estimation prudente).
