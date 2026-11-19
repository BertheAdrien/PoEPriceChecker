---
paths:
  - "src/lib/ninja/**"
  - "scripts/**"
---

# Règles d'accès aux API externes
- Base poe.ninja : `https://poe.ninja/poe1/api/economy`. Détails des endpoints : `docs/data-sources.md`.
- Toujours côté serveur, User-Agent `poe-price-checker/<version> (+<url du repo>)`, cache ≥ 15 min
  (données rafraîchies ~15 min). Jamais de polling plus fréquent.
- Toute réponse passe par un schéma **zod** : un échec de validation lève une erreur explicite (API non contractuelle).
- La ligue = 1re entrée de `/leagues`, jamais codée en dur.
- Wiki Cargo : toujours aliaser `_pageName` (`_pageName=page`), sinon MWException. Pagination par `limit`/`offset` (max 500).
- Une fonction par endpoint ; l'appelant ne voit que des types normalisés (`PriceIndex`), jamais le JSON brut.
