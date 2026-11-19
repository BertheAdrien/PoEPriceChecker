# Roadmap V1

Cocher au fur et à mesure. Une étape = une session courte (`/clear` entre deux étapes).

## Étape 0 — Socle
- [x] `create-next-app` (TS, Tailwind, App Router, `src/`), Vitest, zod, `yaml`, `tsx` pour les scripts
- [x] Scripts npm : `dev, build, test, lint, typecheck, opps, price, import:wiki`
- [x] `git init`, `.gitignore`, premier commit, repo GitHub public

## Étape 1 — Prix (poe.ninja)
- [x] `src/lib/ninja/` : `getLeague()`, `getExchangeOverview(type)`, `getItemOverview(type)` + schémas zod
- [x] `buildPriceIndex()` → `Map<name, { chaos, liquidity, trend, source }>`
      (exchange : Currency, Fragment, DivinationCard, Scarab/Essence/Oil… ; stash : uniques, BaseType, Invitation…)
- [x] Cache mémoire 15 min côté serveur ; tests sur des réponses enregistrées (fixtures réduites)
- [x] CLI `npm run price -- "<item>"` (+ `--league`)

## Étape 2 — Recettes
- [x] Chargement + validation de `data/recipes.yaml` (PNJ, fragments)
- [x] `npm run import:wiki` : `acquisition_recipes` + `acquisition_recipe_parts` → `data/generated/wiki-recipes.json`,
      classées par type : **cartes de divination** (idée 1), **recettes vendeur d'uniques** (idée 2), fragments (idée 3)
- [x] Spike : vérifier si splinters → breachstone, emblèmes, invitations et scarabées sont dans le wiki ; sinon les ajouter au YAML
      → résultat : emblèmes Timeless, Simulacrum, Ritual Vessel, Maven's Writ, shards → orbes présents ; breachstones (non fonctionnelles), scarabées (tirage aléatoire), invitations absents/non modélisables (cf. `docs/data-sources.md`)

## Étape 3 — Moteur
- [x] `evaluateRecipe()` : coût, revenu, `marginPct`, `profitChaos`, liquidité
- [x] Chaînes PNJ : graphe des échanges, meilleur chemin jusqu'à 4 étapes (ex. Jeweller's → Fusing → Scouring)
- [x] **Triangulation** (idée 4) — spike d'abord : poe.ninja ne donne que le prix en chaos + une paire (`maxVolumeRate`).
      Version 1 : écart chaos ↔ divine par currency. Version complète = API Currency Exchange de GGG (paires réelles), à évaluer.
      → résultat : aucun signal (primaryValue = paire la plus échangée), non implémenté ; API GGG = 401 sans OAuth (cf. `docs/data-sources.md`)
- [x] CLI `npm run opps -- --top 20 [--kind ...] [--id ...]`

## Étape 4 — UI
- [x] Page unique : tableau trié par marge %, colonnes marge %, profit (c), coût, liquidité, tendance 7 j, étapes
- [x] Filtres : type d'opportunité, liquidité min, marge min
- [x] **Mode budget** : champ capital (c ou div) → masque ce qui coûte plus que le budget ; affiche le nombre de
      runs possibles et le profit total, plafonné par la liquidité (ex. House of Mirrors = plusieurs centaines de div → masqué)
- [x] **Liste de courses** (détail d'une opportunité) : quoi acheter, combien, où convertir (PNJ / vendor), à quel prix revendre,
      et surtout les **prix seuils** : prix d'achat max de chaque entrée et prix de vente min de la sortie au-delà desquels
      la marge devient nulle (les autres prix étant fixés)
- [x] **Liens trade** uniquement pour les items du trade classique (uniques, etc. via `tradeFilter` de poe.ninja) ;
      pas de lien pour la currency (elle se trade chez Faustus, le Currency Exchange en jeu)
- [x] Bandeau : ligue, heure des données, ratio divine/chaos
- [x] **Vérification trade** : prix poe.ninja du stash re-vérifiés sur le trade officiel (securable, non muté, corruption selon la
      recette), badges « faux positif » / « surestimé », auto-vérification séquentielle du top 10 + bouton dans le détail
- [x] Marge/profit affichés = valeurs **réelles** (trade) quand vérifiées, valeur ninja en sous-texte ; tri par clic sur les en-têtes ;
      colonne Trade = bouton « Ouvrir tout » (liens trade filtrés, détail par item dans la liste de courses)
- [x] Filtre « Profit total min » (budget ou plafond de liquidité) au lieu d'un seuil par run (qui masquait la currency bon marché)
- [x] Corruption : entrées **non corrompues exigées par défaut** ; exceptions sourcées dans `data/recipe-overrides.yaml`

## Étape 4 bis — Corrections en cours (à traiter avant le déploiement)
- [x] **Filtres** (« profit total min » filtrait sur une valeur invisible) : simplifiés à la demande de l'utilisateur
      (2026-11-19) → Type, Marge min, **Profit min par run** (= colonne Profit), Budget, conditionnelles. Colonnes Liquidité,
      Runs et Profit total retirées (jugées inutiles). Filtres de prix appliqués aux valeurs trade **vérifiées** si disponibles
      (autoIds choisis sur les prix ninja pour éviter une cascade). Logique dans `src/components/filters.ts` (testée).
- [x] **Liste de courses = page dédiée** `/opportunite?id=…&runs=…` (même onglet ; Ctrl+clic / molette = nouvel onglet) ;
      filtres, tri, défilement et vérifications conservés dans l'onglet (`sessionStorage`, vérifs invalidées si les prix changent) ;
      vérification trade automatique à l'ouverture ; cartouche d'état trade par ligne (à vérifier / en cours / ✓ / échec)
- [x] **Refonte graphique « Runes de feu »** (2026-11-19, maquettes Claude Design) : thème obsidienne/or/braise
      (tokens dans `globals.css`, composants `src/components/ui/`), polices Cinzel / Cormorant / Plex / JetBrains,
      noms d'items colorés par catégorie poe.ninja (`payload.categories`), types de filtre en anglais, groupe
      « Essences & Oils » (`filterKind`), sparkline 7 j (`trendSeries`), runs saisissables dans la liste de courses
- [ ] Flesh of Xesht sur un Dream corrompu : l'utilisateur pense que c'est accepté ; le wiki ne le dit pas (seule mention :
      refusé sur Skin of the Lords, toujours corrompu). En attente d'un test en jeu (et : la sortie est-elle corrompue ?)
- [ ] Recettes vendeur d'uniques dont l'acceptation des corrompus est inconnue (Lost Unity, Magna Eclipsis, Arborix, Goddess Scorned) :
      à tester en jeu ; Kingmaker/Duskdawn sont classées `other` alors que ce sont des recettes vendeur (classification wiki à affiner)
- [x] Avertissements Turbopack (lectures `fs`) : `/*turbopackIgnore: true*/`, `data/` copié explicitement dans l'image

## Étape 5 — Déploiement
- [x] https://poe-price-checker.bertadrien.fr : Dockerfile (`output: "standalone"`), docker-compose, nginx de l'hôte + certbot,
      mot de passe basic auth (cf. `docs/deploy.md`)
- [ ] GitHub Actions : tests + build de l'image à chaque push

## Étape 6 — Alertes (fin de V1)
- [ ] Webhook Discord (URL en variable d'environnement) quand une opportunité dépasse X % avec liquidité ≥ Y, sans doublons

## Plus tard (hors V1, décidé le 2026-11-19)
- Suivi des gains réels (prévu vs réalisé)
- Profit/heure, anomalies de prix, gemmes, achat en gros vs à l'unité, trading sur le Currency Exchange
- **Bases influencées** (mis de côté le 2026-11-19) : base sans influence + exalt de conquérant (Crusader/Redeemer/Hunter/
  Warlord) → même base influencée, même ilvl. Données dispo : poe.ninja `stash … type=BaseType` (~16 500 lignes, 1 requête
  / 15 min) avec `levelRequired` = tranche d'ilvl (82–86) et `variant` = influence ; exalts dans l'exchange Currency.
  À faire : index des bases par nom+ilvl+influence (l'index actuel est par nom), génération automatique des opportunités,
  vérification/liens trade filtrés par ilvl, influence et rareté (prix ninja peu fiables : souvent < 5 annonces).
  **À vérifier avant de coder** (poe-researcher) : l'exalt exige-t-il un item rare (alch en plus) et le prix ninja d'une
  base influencée correspond-il à un rare avec un mod aléatoire ? la tranche 86 = « 86 et plus » ?
