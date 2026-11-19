# Économie PoE 1 — ce qui compte pour l'arbitrage

> Document vivant. Chaque affirmation non triviale doit être vérifiée en jeu ou sur le wiki
> à chaque nouvelle ligue (GGG modifie régulièrement recipes et prix PNJ).

## Unités
- **Chaos Orb (c)** : unité de compte. **Divine Orb (div)** : unité des gros prix (ratio div/c fluctue).
- Les prix sont **par ligue** (Standard ≠ ligue challenge). Hardcore/SSF exclus.

## Les leviers d'arbitrage (types de "conversions")
1. **Achat PNJ (vendor shop)** — les vendeurs de ville vendent certaines currencies contre d'autres
   à taux fixe et **en quantité illimitée**. Si `taux_PNJ × prix_marché(entrée) < prix_marché(sortie)`,
   marge. Exemple utilisateur : 1 Scouring = 4 Fusing chez le PNJ ; Fusing à 1/6 c → coût 0.67c,
   Scouring vendue 1.2c → ~+80 % brut (le "35 %" annoncé est à recalculer avec les vrais prix bid/ask).
2. **Vendor recipes** — vendre une combinaison d'items au PNJ donne un item fixe
   (ex. recipes de currency, de qualité, d'uniques "assemblés"). Exemple utilisateur :
   Lost Unity ← 5 rings breach spécifiques (⚠️ recette exacte à vérifier dans `data/recipes.yaml`).
3. **Currency Exchange (Faustus)** — carnet d'ordres in-game ; écarts bid/ask et triangulations
   (A→B→C→A) possibles. Taxe/frais éventuels à prendre en compte.
4. **Fragments / sets** — assembler ou désassembler (fragments de boss, splinters → emblem/breachstone,
   scarabs 3→1 au PNJ, etc.).
5. **Crafts déterministes** — essences, bench, harvest… (phase ultérieure, plus aléatoire).

## Pièges à intégrer dans le calcul
- **Spread** : on achète au prix vendeur, on revend au prix acheteur. poe.ninja `pay` vs `receive`.
- **Liquidité** : une marge de 300 % sur un item à 2 listings ne vaut rien. Afficher volume/listings.
- **Temps** : coût en minutes (whispers, échanges, clics PNJ). Marge/heure > marge %.
- **Prix manipulés** (price fixing) : filtrer les items à faible nombre de listings / écart à la médiane.
- **Plafonds** : taille de stack, place en inventaire, limites d'achat éventuelles.
- **Début vs fin de ligue** : les opportunités évoluent fortement ; l'historique sert à repérer les tendances.
