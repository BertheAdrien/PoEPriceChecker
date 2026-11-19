# PoE Price Checker

Appli perso (PoE 1, **ligue challenge en cours uniquement**, softcore trade) qui classe les
**arbitrages** par marge % : acheter A, convertir (PNJ, recette vendeur, set de cartes de divination,
fragments, triangulation sur le Currency Exchange), revendre B.

## Stack
Next.js (App Router) + TypeScript + Tailwind · zod · Vitest · Docker sur un VPS · repo GitHub public.
Pas de base de données, pas d'historique (la sparkline 7 j de poe.ninja suffit).

## Structure (cible)
- `src/lib/ninja/` — client poe.ninja (fetch serveur, cache 15 min, schémas zod)
- `src/lib/recipes/` — chargement des recettes (YAML manuel + JSON importé du wiki)
- `src/lib/engine/` — calcul des marges, chaînes, triangulation (fonctions pures)
- `src/app/` — UI
- `scripts/` — CLI : import wiki, `opps` (top opportunités), `price` (prix d'un item)
- `data/recipes.yaml` — recettes manuelles (boutiques PNJ…) · `data/generated/` — fichiers générés, **ne pas lire**

## Commandes
`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck`
À venir (étapes 1 à 3 de `docs/roadmap.md`) : `npm run price -- "Orb of Fusing"` · `npm run import:wiki` · `npm run opps -- --top 20`

Next.js **16** (cacheComponents activé) : en cas de doute sur une API Next, lire la doc embarquée
`node_modules/next/dist/docs/` (cf. `AGENTS.md`) plutôt que de se fier à la mémoire.

## Règles transverses
- **Ne jamais inventer** une recette, un prix PNJ ou une mécanique du jeu : sourcer (wiki/poedb/jeu) ou marquer `verified: false`.
- Pour un prix ou une donnée de jeu : **utiliser les scripts CLI** (sortie compacte), pas de curl qui renvoie des centaines de Ko de JSON.
- Recherche sur le jeu (wiki, mécaniques, patch notes) → déléguer à l'agent `poe-researcher`.
- Pas de secrets dans le code (règle d'organisation) → variables d'environnement.
- Réseau : si les sites PoE renvoient ECONNRESET, c'est le filtre de la box de l'utilisateur → lui demander de passer en 4G.

## Docs (à lire seulement si besoin)
- `docs/data-sources.md` — endpoints poe.ninja / wiki Cargo / GGG, forme des réponses, pièges
- `docs/game-economy.md` — mécaniques économiques et pièges d'arbitrage

Code et identifiants en anglais, docs et échanges en français.
