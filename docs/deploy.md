# Déploiement (VPS)

https://poe-price-checker.bertadrien.fr — protégé par mot de passe (basic auth nginx, utilisateur `adrien`).

## Architecture
- VPS Debian 12 (1 CPU, 2 Go), accès `ssh debian@193.70.113.80` (clé du PC de l'utilisateur).
- Source : `~/poe-price-checker` (clone du repo GitHub public). Image construite **sur le VPS** : `poe-price-checker:local`.
- Conteneur via `docker-compose` (v2 standalone : `docker-compose`, pas `docker compose`) → `127.0.0.1:3020`.
- nginx de l'hôte : `/etc/nginx/sites-available/poe-price-checker.bertadrien.fr.conf` (proxy, `proxy_buffering off`
  pour le streaming Suspense), HTTPS par certbot (`--nginx`, renouvellement automatique).
- Mot de passe : `/etc/nginx/.htpasswd-poe-price-checker` (hors repo, `root:www-data`, 640). Aucun secret dans l'image.
- D'autres sites tournent sur ce VPS (`breach-academy` sur 3010, sites PHP) : ne pas toucher aux autres confs nginx.

## Limite connue : pas de vérification trade en prod
Le trade officiel répond **403 `{"error":{"code":6,"message":"Forbidden"}}`** aux requêtes venant du VPS (IP d'hébergeur
OVH), **même avec un `POESESSID`** (testé le 2026-11-19) ; depuis la box de l'utilisateur, ça fonctionne sans session.
En prod, au premier 403 le serveur cesse d'interroger le trade pendant 1 h (`src/lib/trade/blocked.ts`) et l'UI affiche
« trade indisponible ici » ; prix poe.ninja et liens trade restent utilisables. Vérification automatique : en local.

## Mettre à jour
```sh
ssh debian@193.70.113.80 'cd ~/poe-price-checker && git pull && docker build -q -t poe-price-checker:local . && docker-compose up -d'
```

## Comptes (dans un vrai terminal, PowerShell ou bash : saisie masquée)
Plusieurs comptes possibles : une ligne `utilisateur:hash` par compte dans `/etc/nginx/.htpasswd-poe-price-checker`
(relu par nginx à chaque requête, pas de rechargement). Ne jamais réécrire tout le fichier (`tee` sans `-a`) : ça
supprimerait les autres comptes.

Ajouter un compte :
```sh
ssh -t debian@193.70.113.80 'read -p "Nouvel utilisateur : " u && h=$(openssl passwd -apr1) && echo "$u:$h" | sudo tee -a /etc/nginx/.htpasswd-poe-price-checker >/dev/null && echo "OK : $u ajouté"'
```

Changer le mot de passe d'un compte (remplace seulement sa ligne) :
```sh
ssh -t debian@193.70.113.80 'read -p "Utilisateur : " u && h=$(openssl passwd -apr1) && sudo sed -i "/^$u:/d" /etc/nginx/.htpasswd-poe-price-checker && echo "$u:$h" | sudo tee -a /etc/nginx/.htpasswd-poe-price-checker >/dev/null && echo OK'
```

Supprimer un compte / lister les comptes :
```sh
ssh -t debian@193.70.113.80 'read -p "Utilisateur à supprimer : " u && sudo sed -i "/^$u:/d" /etc/nginx/.htpasswd-poe-price-checker && echo OK'
ssh debian@193.70.113.80 'sudo cut -d: -f1 /etc/nginx/.htpasswd-poe-price-checker'
```
Droits attendus du fichier : `root:www-data`, 640 (`tee -a` et `sed -i` les conservent).

## Diagnostic
`docker ps` · `docker logs --tail 50 poe-price-checker-app-1` · `sudo tail /var/log/nginx/poe-price-checker.bertadrien.fr.error.log`
