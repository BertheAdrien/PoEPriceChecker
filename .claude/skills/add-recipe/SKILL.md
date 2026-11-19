---
name: add-recipe
description: Ajouter, corriger ou vérifier une conversion manuelle (boutique PNJ, recette vendeur, set de fragments) dans data/recipes.yaml. À utiliser quand l'utilisateur signale un échange ou une recette du jeu.
---

1. Vérifier la recette : déléguer à l'agent `poe-researcher` si elle n'est pas fournie avec une source.
   Vérifier aussi qu'elle n'existe pas déjà dans l'import du wiki : `npm run price -- --recipe "<item produit>"`.
2. Ajouter l'entrée dans `data/recipes.yaml` au format existant :
   `id` (kebab-case), `kind` (vendor_shop | vendor_recipe | fragment_set), `inputs`, `outputs`
   (noms anglais **exacts** de poe.ninja), `vendor` si PNJ, `source`, `verified` (date + ligue, ou `false`).
   Pour corriger une recette **déjà importée du wiki** (ex. elle accepte les entrées corrompues), ne pas la
   dupliquer : ajouter son id dans `data/recipe-overrides.yaml` (`corruptedInputs`, `source`, `verified`).
   Par défaut toutes les recettes exigent des entrées non corrompues : ne passer à `allowed` qu'avec une source.
3. Valider : `npm test -- recipes` (schéma YAML + noms connus de poe.ninja).
4. Montrer à l'utilisateur la marge actuelle : `npm run opps -- --id <id>`.
