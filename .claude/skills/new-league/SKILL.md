---
name: new-league
description: Checklist de début de ligue PoE (ou de nouveau patch) - re-importer les recettes du wiki, vérifier les API et les recettes manuelles. À utiliser quand l'utilisateur annonce une nouvelle ligue ou un patch.
---

1. Ligue courante : `npm run price -- --league` (doit afficher la nouvelle ligue challenge).
2. Re-importer les recettes : `npm run import:wiki`, puis résumer le diff (`git diff --stat data/generated`)
   sans lire le fichier généré.
3. Vérifier que les API répondent toujours au schéma : `npm test -- ninja`.
4. Passer en `verified: false` les entrées de `data/recipes.yaml` dont la ligue n'est pas la nouvelle,
   et demander à `poe-researcher` les changements des patch notes sur les boutiques PNJ et les recettes vendeur.
5. Mettre à jour la date de vérification dans `docs/data-sources.md`.
6. `npm run opps -- --top 20` et présenter le résultat à l'utilisateur.
