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
- **Sémantique réelle** : `_pageName` = item PRODUIT ; `description` décrit la sortie ; les `parts` sont les ENTRÉES. Clés de réponse avec espaces (`"recipe id"`), valeurs HTML-échappées.
- Cartes de divination : table `items` avec `class_id="DivinationCard"` (~470 cartes).
- Rate limit : Cloudflare renvoie 429 ou une page HTML « Just a moment » (HTTP 200) après ~25 requêtes rapprochées ; l'import réessaie avec backoff (5 s jusqu'à 2 min). Si ça persiste, attendre quelques minutes.
- Autres tables utiles : `items`, `vendor_rewards` (récompenses de quêtes), `bestiary_recipes`, `blight_crafting_recipes`.
- Source wikitext d'une page : `action=parse&page=<Nom>&prop=wikitext&format=json&formatversion=2`.
- ⚠️ Les **taux de la boutique PNJ** (ex. 4 Fusing → 1 Scouring) ne sont pas encore localisés dans une table → `data/recipes.yaml` manuel en attendant.

### Import `npm run import:wiki` (classification)
~19 300 recettes en entrée, ~620 gardées dans `data/generated/wiki-recipes.json` (172 Ko, une recette par ligne).
- **Écartées** (~97 %) : sorties aléatoires (description « Random … », « set exchange », « other gems/currencies », « transfigured gem »), « part of sell price », prophéties, corruption, parts contenant du HTML ou de l'or, pages génériques (`Map (Tier N)`), et les **pools** (mêmes entrées + même description menant à plusieurs sorties = tirage au sort).
  Les ~17 000 lignes `automatic` sont du bruit : chaque carte/fragment y figure comme *résultat possible* d'un tirage.
- **Kinds** : `vendor_recipe` (description « Vendor recipe »), `div_card` (une seule entrée, présente dans `items` classe DivinationCard), `fragment_set` (une entrée « …Splinter/Shard/Fragment » ×N>1), `other` (le reste : flasques/filets ×3, cosmétiques…).
- **`conditional: true`** (~136) quand description/notes mentionnent corrupted, link, level, quality, influence, implicit, rarity, any, tier… : la sortie dépend d'une variante, à ignorer ou traiter à part dans le moteur.
- Id = `<slug du produit>-<recipe_id>` ; `mergeRecipes` écarte aussi une recette wiki de mêmes entrées/sorties qu'une recette YAML (le YAML gagne).
- ⚠️ Le wiki dit **House of Mirrors ×9 → Mirror of Kalandra** (recette 2) : à confirmer en jeu avant de s'y fier.
- **Fragments (spike)** — présents : shards → orbes (Chaos, Exalted, Mirror…, ×20), Timeless splinters → emblèmes (×100), Simulacrum Splinter ×300, Ritual Splinter ×100, Crescent Splinter ×10 → The Maven's Writ, Scroll Fragment ×5. **Absents** : splinters de Breach → Breachstone (les pages disent « 100 splinters » mais les breachstones sont non fonctionnelles, revendues contre une Hivebrain Gland : non ajoutées), recettes de scarabées (3 scarabées → 1 aléatoire, non déterministe), invitations, fragments Sacrifice/Mortal.

## 3. API officielle GGG
Doc : https://www.pathofexile.com/developer/docs
- **Currency Exchange API** (scope `service:cxapi`, accès public mentionné) : historique horaire des ratios et volumes. Phase 2.
- **Trade API** : rate limits stricts, pour vérification ponctuelle seulement.

### Spike triangulation (2026-11-19, Covens)
- Exchange overview, types Currency/Fragment/DivinationCard/Scarab/Essence : 648 lignes, `maxVolumeCurrency` = `chaos` (601) ou `divine` (47).
- Pour les 47 lignes en `divine`, prix implicite `divineChaos / maxVolumeRate` = `primaryValue` (écart < 0,5 % pour toutes) ; idem `1 / maxVolumeRate` pour les lignes en chaos.
  → `primaryValue` est dérivé de cette paire : **aucun signal d'arbitrage**, triangulation non implémentée.
- API Currency Exchange GGG (`GET https://api.pathofexile.com/currency-exchange`) : **401 Unauthorized sans OAuth** (`{"error":{"code":8,"message":"Unauthorized"}}`) ; il faut un token (scope `service:cxapi`). Non utilisable sans compte/app enregistrée.

### Trade API (vérification des prix du stash)
Code : `src/lib/trade/` ; endpoint interne `GET /api/verify?id=<id d'opportunité>`.
- `POST https://www.pathofexile.com/api/trade/search/<league>` → `{id, total, result:[hashes]}`. Sans authentification.
  Corps : `{"query":{"status":{"option":"securable"},"name":…,"type":…,"filters":{"misc_filters":{"filters":{"corrupted":{"option":"false"},"mutated":{"option":"false"}}}}},"sort":{"price":"asc"}}`.
  `securable` = achat instantané. Uniques : `name` + `type` (= baseType poe.ninja) ; autres items du stash : `type` seul.
- `GET …/api/trade/fetch/<≤10 hashes séparés par des virgules>?query=<id>` → `result[].listing.price {amount, currency}`
  (`chaos`, `divine`, autres devises converties via l'index poe.ninja si résolvables, sinon l'annonce est ignorée) et `result[].item`.
- Prix retenu = médiane des 5 annonces les moins chères ; cache 15 min par requête. 1 recherche + 1 fetch par item.
- **Limites** (en-têtes) : `X-Rate-Limit-Ip: 5:10:60,15:60:300,30:300:1800,600:21600:3600` (`hits:période s:pénalité s`) et
  `X-Rate-Limit-Ip-State` (hits courants ; 3e champ = secondes de restriction). Le fetch a sa propre politique. Dépasser une
  fenêtre = IP bloquée pour la pénalité. Le limiteur (`limiter.ts`) sérialise tout, reste une requête sous chaque limite,
  apprend les règles des en-têtes et respecte `Retry-After` / restrictions (429 → l'endpoint répond 429 + `Retry-After`).
- User-Agent : `poe-price-checker/0.1 (+https://github.com/BertheAdrien/PoEPriceChecker)`.
- **Pièges**
  - poe.ninja mélange copies **corrompues et non corrompues** dans le prix d'un unique : une recette qui exige une entrée non
    corrompue (on applique de la currency / un objet dessus, kind `other`) paraît bien plus rentable qu'elle ne l'est.
    Ex. (Covens) The Red Dream + Flesh of Xesht → The Red Nightmare : +252 % sur poe.ninja (2 div → 8 div), ~+6 % sur le trade
    (7 div → 8 div, non corrompu).
  - Politique par recette `corruptedInputs` (`allowed` | `forbidden`, défaut dérivé du kind par `corruptedInputPolicy` :
    `vendor_recipe` → allowed, sinon forbidden ; surchargeable dans le YAML). Entrées : filtre `corrupted:false` seulement si
    forbidden ; sorties : toujours `corrupted:false`.
  - **Foulborn** (`mutated`) : sans `mutated:false` ces copies sont incluses. poe.ninja les liste sous « Foulborn <nom> » :
    ces items ne sont pas vérifiés.
  - Seuls les items du stash sont vérifiés ; currency, cartes, fragments (exchange) gardent le prix poe.ninja.

## 4. RePoE
https://github.com/lvlvllvlvllvlvl/RePoE — JSON extraits du jeu (bases, mods, gemmes). Référentiel d'items si besoin.
