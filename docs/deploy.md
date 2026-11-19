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

## Mettre à jour
```sh
ssh debian@193.70.113.80 'cd ~/poe-price-checker && git pull && docker build -q -t poe-price-checker:local . && docker-compose up -d'
```

## Changer le mot de passe (dans un vrai terminal, PowerShell ou bash : saisie masquée)
```sh
ssh -t debian@193.70.113.80 'h=$(openssl passwd -apr1) && echo adrien:$h | sudo tee /etc/nginx/.htpasswd-poe-price-checker >/dev/null && sudo chown root:www-data /etc/nginx/.htpasswd-poe-price-checker && sudo chmod 640 /etc/nginx/.htpasswd-poe-price-checker && echo OK'
```

## Diagnostic
`docker ps` · `docker logs --tail 50 poe-price-checker-app-1` · `sudo tail /var/log/nginx/poe-price-checker.bertadrien.fr.error.log`
