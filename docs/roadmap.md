# Roadmap V1

Cocher au fur et à mesure. Une étape = une session courte (`/clear` entre deux étapes).

## Étape 0 — Socle
- [ ] `create-next-app` (TS, Tailwind, App Router, `src/`), Vitest, zod, `yaml`, `tsx` pour les scripts
- [ ] Scripts npm : `dev, build, test, lint, typecheck, opps, price, import:wiki`
- [ ] `git init`, `.gitignore`, premier commit, repo GitHub public

## Étape 1 — Prix (poe.ninja)
- [ ] `src/lib/ninja/` : `getLeague()`, `getExchangeOverview(type)`, `getItemOverview(type)` + schémas zod
- [ ] `buildPriceIndex()` → `Map<name, { chaos, liquidity, trend, source }>`
      (exchange : Currency, Fragment, DivinationCard, Scarab/Essence/Oil… ; stash : uniques, BaseType, Invitation…)
- [ ] Cache mémoire 15 min côté serveur ; tests sur des réponses enregistrées (fixtures réduites)
- [ ] CLI `npm run price -- "<item>"` (+ `--league`)

## Étape 2 — Recettes
- [ ] Chargement + validation de `data/recipes.yaml` (PNJ, fragments)
- [ ] `npm run import:wiki` : `acquisition_recipes` + `acquisition_recipe_parts` → `data/generated/wiki-recipes.json`,
      classées par type : **cartes de divination** (idée 1), **recettes vendeur d'uniques** (idée 2), fragments (idée 3)
- [ ] Spike : vérifier si splinters → breachstone, emblèmes, invitations et scarabées sont dans le wiki ; sinon les ajouter au YAML

## Étape 3 — Moteur
- [ ] `evaluateRecipe()` : coût, revenu, `marginPct`, `profitChaos`, liquidité
- [ ] Chaînes PNJ : graphe des échanges, meilleur chemin jusqu'à 4 étapes (ex. Jeweller's → Fusing → Scouring)
- [ ] **Triangulation** (idée 4) — spike d'abord : poe.ninja ne donne que le prix en chaos + une paire (`maxVolumeRate`).
      Version 1 : écart chaos ↔ divine par currency. Version complète = API Currency Exchange de GGG (paires réelles), à évaluer.
- [ ] CLI `npm run opps -- --top 20 [--kind ...] [--id ...]`

## Étape 4 — UI
- [ ] Page unique : tableau trié par marge %, colonnes marge %, profit (c), coût, liquidité, tendance 7 j, étapes
- [ ] Filtres : type d'opportunité, liquidité min, marge min, coût max (budget)
- [ ] Bandeau : ligue, heure des données, ratio divine/chaos ; lien vers le trade officiel quand dispo (`tradeFilter`)

## Étape 5 — Déploiement
- [ ] Dockerfile (`output: "standalone"`), docker compose, reverse proxy (Caddy/nginx) sur le VPS
- [ ] GitHub Actions : tests + build de l'image à chaque push

## Étape 6 — Alertes (fin de V1)
- [ ] Webhook Discord (URL en variable d'environnement) quand une opportunité dépasse X % avec liquidité ≥ Y, sans doublons
