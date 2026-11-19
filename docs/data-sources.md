# Sources de données

> Vérifié en direct le 2026-11-19 (ligue **Covens**, patch 3.27+).
> ⚠️ Le réseau fixe de l'utilisateur (filtre de box) bloque les sites PoE → tester en 4G,
> ou laisser GitHub Actions faire les appels.

## 1. poe.ninja — prix (source principale)
Doc officielle : https://poe.ninja/docs/api — base `https://poe.ninja/poe1/api/economy`

| Endpoint | Usage |
|---|---|
| `GET /leagues` | `[{id,name}]` ; **1re entrée = ligue challenge courante** (ex. `Covens`) |
| `GET /exchange/current/overview?league=&type=` | Prix issus du **Currency Exchange** in-game. Types : `Currency, Fragment, Runegraft, AllflameEmber, Tattoo, Omen, DjinnCoin, Ducat, EnshroudingCrystal, DivinationCard, Artifact, Oil, DeliriumOrb, …` (liste complète dans la doc) |
| `GET /stash/current/item/overview?league=&type=` | Prix issus des stashes publics. Types : `UniqueWeapon, UniqueArmour, UniqueAccessory, UniqueFlask, UniqueJewel, SkillGem, ClusterJewel, Map, BaseType, Beast, Incubator, Invitation, …` |
| `GET /stash/current/currency/overview?league=&type=Currency\|Fragment` | Ancienne source currency (stashes) — **peu fiable pour la currency bon marché** (valeurs arrondies à 1c, peu de listings). Préférer l'exchange. |

### Forme des réponses
- **Exchange** : `core.primary="chaos"`, `core.secondary="divine"`, `core.rates`, `items[]` (id→nom/icône),
  `lines[]` : `{id, primaryValue (prix en chaos), volumePrimaryValue (volume échangé en chaos),
  maxVolumeCurrency, maxVolumeRate (unités par chaos), sparkline{totalChange, data[7]}}`.
  Ids courts : `fusing`, `scour`, `divine`, `chaos`… (mapper via `items[]`).
  ⚠️ Une seule valeur par item (pas de bid/ask séparés) → appliquer une marge de sécurité configurable.
- **Item** : `lines[]` : `{name, baseType, variant, links, chaosValue, divineValue, count, listingCount, sparkLine, tradeFilter, …}`.

### Règles d'usage (doc poe.ninja)
- Données PoE1 rafraîchies **~toutes les 15 min** ; cache HTTP ~5 min (ETag) → requêtes conditionnelles.
- User-Agent descriptif obligatoire (nom de l'appli + contact). Pas de scraping massif, pas de clone du site.
- Pas de garantie de stabilité → adaptateur isolé + tests de forme de réponse.

## 2. Wiki PoE — recettes (source principale des conversions)
API Cargo : `https://www.poewiki.net/w/api.php?action=cargoquery&format=json&tables=...&fields=...&where=...`

- `acquisition_recipes` (~19 300 lignes) : `recipe_id, description, result_amount, automatic`
- `acquisition_recipe_parts` (~19 600 lignes) : `recipe_id, part_id, item_name, item_id, item_page, amount, notes`
- Clé de jointure : `_pageName` (page de l'item **produit**) + `recipe_id`.
- ⚠️ **Toujours aliaser `_pageName`** (`fields=_pageName=page,...`), sinon erreur MWException.
- Exemple vérifié : `tables=acquisition_recipe_parts&fields=_pageName=page,recipe_id,item_name,amount&where=item_name="The Sundered Will"`
- Contient vendor recipes, cartes de divination → items, etc. À filtrer par type.
- Autres tables utiles : `items`, `vendor_rewards` (récompenses de quêtes), `bestiary_recipes`, `blight_crafting_recipes`.
- Source wikitext d'une page : `action=parse&page=<Nom>&prop=wikitext&format=json&formatversion=2`.
- ⚠️ Les **taux de la boutique PNJ** (ex. 4 Fusing → 1 Scouring) ne sont pas encore localisés dans une table → `data/recipes.yaml` manuel en attendant.

## 3. API officielle GGG
Doc : https://www.pathofexile.com/developer/docs
- **Currency Exchange API** (scope `service:cxapi`, accès public mentionné) : historique horaire des ratios et volumes. Phase 2.
- **Trade API** : rate limits stricts, pour vérification ponctuelle seulement.

## 4. RePoE
https://github.com/lvlvllvlvllvlvl/RePoE — JSON extraits du jeu (bases, mods, gemmes). Référentiel d'items si besoin.
