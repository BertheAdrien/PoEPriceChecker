# PoE Price Checker

Détecteur d'arbitrages pour **Path of Exile 1** (ligue challenge en cours) : échanges PNJ et leurs chaînes,
sets de cartes de divination, recettes vendeur d'uniques, fragments, triangulation sur le Currency Exchange.
Classement par marge %, avec profit en chaos, liquidité et tendance sur 7 jours.

Prix : [poe.ninja](https://poe.ninja/docs/api) · Recettes : [wiki PoE](https://www.poewiki.net) (API Cargo).

## Démarrer
```bash
npm install
npm run dev      # http://localhost:3000
npm test
```

Node ≥ 24. Voir `docs/` pour les sources de données et la roadmap.

### Lancement en un clic (Windows)
1. Installer [Node.js](https://nodejs.org) LTS (24 ou plus) — et [Git](https://git-scm.com) pour recevoir les mises à jour.
2. `git clone https://github.com/BertheAdrien/PoEPriceChecker.git` (ou télécharger le ZIP depuis GitHub et le décompresser).
3. Double-cliquer sur `lancer.bat` : installation + compilation au premier lancement (quelques minutes), puis ouverture
   de http://localhost:3030. Le script récupère les mises à jour (`git pull`) et recompile seulement si besoin.
   Fermer la fenêtre arrête l'application.

Projet non affilié à Grinding Gear Games.
