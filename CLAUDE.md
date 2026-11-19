# PoE Price Checker

Appli perso (PoE 1, **ligue challenge en cours uniquement**, softcore trade) qui classe les
**arbitrages** par marge % : acheter A, convertir (PNJ, recette vendeur, set de cartes de divination,
fragments), revendre B. Les prix poe.ninja servent à **repérer**, le trade officiel à **vérifier**.

## Stack
Next.js 16 (App Router, `cacheComponents`) + React 19 + TypeScript + Tailwind 4 · zod · Vitest · tsx.
Docker sur un VPS (https://poe-price-checker.bertadrien.fr) · repo GitHub public `BertheAdrien/PoEPriceChecker`. Pas de base de données, pas d'historique.

## Structure
- `src/lib/ninja/` — client poe.ninja (zod, retry 429) · `src/lib/prices/` — `buildPriceIndex()` (cache mémoire 15 min, cache disque pour le CLI)
- `src/lib/recipes/` — YAML manuel + JSON importé du wiki + `recipe-overrides.yaml` ; `policy.ts` = règle de corruption
- `src/lib/engine/` — marges, prix seuils, chaînes PNJ, budget (fonctions pures)
- `src/lib/trade/` — API trade officielle : rate limiter, recherche, vérification, liens filtrés
- `src/app/` (page + `/api/verify`), `src/components/` (dashboard, liste de courses)
- `data/recipes.yaml` (PNJ…) · `data/recipe-overrides.yaml` (corrections par id) · `data/generated/` (généré, **ne pas lire**)

## Commandes
`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run build`
`npm run price -- "Orb of Fusing"` (`--search`, `--league`) · `npm run opps -- --top 20` (`--kind`, `--id`, `--conditional`) · `npm run import:wiki`

## Règles transverses
- **Ne jamais inventer** une recette, un prix PNJ ou une mécanique du jeu : sourcer (wiki/poedb/jeu) ou marquer `verified: false`.
- Pour un prix ou une donnée de jeu : **utiliser les scripts CLI** (sortie compacte, cache disque 15 min), jamais de curl brut sur poe.ninja
  (centaines de Ko, et on s'est déjà pris un 429). Recherche sur le jeu → agent `poe-researcher`.
- **Corruption** : toutes les recettes exigent des entrées non corrompues par défaut ; une exception = entrée sourcée dans `recipe-overrides.yaml`.
  Les sorties sont toujours comparées aux exemplaires non corrompus ; Foulborn (muté) toujours exclu.
- poe.ninja **mélange corrompus et non corrompus** pour les uniques → toute marge sur un unique doit passer par la vérification trade.
- API trade : respecter le rate limiter (`src/lib/trade/limiter.ts`) ; ne jamais faire de requêtes trade en parallèle ni en masse.
- Pas de secrets dans le code (règle d'organisation) → variables d'environnement.
- Ne commiter/pousser que sur demande de l'utilisateur (déjà autorisé pour les étapes de la roadmap).

## Pièges d'environnement (Windows de l'utilisateur)
- Sites PoE en ECONNRESET = filtre de sa box → lui demander de passer en **4G**.
- Ne jamais lancer de serveur sur le port 3000 (l'utilisateur y fait tourner `npm run dev`) ; tester sur un autre port et **tuer le
  processus enfant `node … start-server.js`** après (un orphelin a déjà bloqué le port).
- Warnings d'hydratation `bis_skin_checked` / `bis_register` / `__processed_…` = extensions de son navigateur, pas notre code.
- Next 16 : en cas de doute sur une API, la doc embarquée est dans `node_modules/next/dist/docs/` (cf. `AGENTS.md`) ; la lecture
  de `node_modules` est bloquée par `.claude/settings.json` sauf si l'utilisateur l'a assouplie.

## Docs (à lire seulement si besoin)
- `docs/roadmap.md` — **état d'avancement et points ouverts** (lire en début de session)
- `docs/data-sources.md` — endpoints poe.ninja / wiki Cargo / trade / GGG, forme des réponses, pièges
- `docs/deploy.md` — VPS, mise à jour, mot de passe
- `docs/game-economy.md` — mécaniques économiques et pièges d'arbitrage

Code et identifiants en anglais, docs et échanges en français.
