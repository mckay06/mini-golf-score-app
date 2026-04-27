# Mini-Golf Score App

Prototype mobile-first pour VR Infini : saisie de score piste par piste et classement partagé.

## Ce qui a été finalisé

- reprise de partie après refresh via localStorage
- classement live avec rafraîchissement manuel et automatique
- API health check pour les tests
- smoke test isolé qui vérifie config, envoi score et classement sans salir les vraies données

## Lancer en local

```bash
npm run start:minigolf
```

Puis ouvrir :

```text
http://localhost:3010/mini-golf
```

## Tester automatiquement

```bash
npm run test:minigolf
```

Le test lance un serveur temporaire, injecte un score fictif dans un fichier temporaire, vérifie le classement puis nettoie tout.

## Ce que fait le prototype

- saisie d'un nom de joueur ou d'équipe
- 8 pistes avec score par piste
- total automatique
- envoi du score au serveur
- classement des meilleurs scores
- historique des derniers scores
- manifest + service worker pour une sensation d'app web installable

## Important : persistance en production

Les scores sont stockes dans un fichier JSON. Par defaut :

```text
mini-golf-score-app/data/leaderboard.json
```

En local, ce fichier reste bien en memoire sur le disque. En ligne, il faut verifier l'hebergement :

- si le serveur redemarre ou si l'app est redeployee sans disque/volume persistant, les scores peuvent revenir au fichier de depart du depot Git ;
- si l'app tourne en serverless, le stockage fichier ne doit pas etre considere comme durable ;
- pour un deploiement Node avec volume persistant, definir `MINIGOLF_LEADERBOARD_FILE` vers le fichier du volume, par exemple `/data/leaderboard.json` selon l'hebergeur ;
- pour un deploiement sans volume persistant, remplacer le stockage fichier par une vraie base externe : Supabase, Firebase, PostgreSQL, MySQL/WordPress, etc.

Deux limites sont configurables :

```text
MINIGOLF_MAX_STORED_ROUNDS=5000
MINIGOLF_PUBLIC_RECENT_ROUNDS=50
```

Le classement public affiche le Top 5 du mois et les derniers scores du mois. L'admin `/mini-golf/admin.html` affiche tous les scores stockes.

## Option recommandee : stockage WordPress

Si le plugin WordPress `VR Infini Mini Golf Scores` est installe, l'app utilise par defaut :

```text
https://vrinfini.com/wp-json/vrinfini-minigolf/v1
```

Les scores sont alors stockes dans la base WordPress au lieu du disque Render. Le ZIP du plugin installe est genere localement dans le dossier :

```text
wordpress-plugins/vri-minigolf-scores-v2.zip
```

Installation : WordPress > Extensions > Ajouter une extension > Televerser une extension, puis activer. Un menu `Scores Mini Golf` apparait dans l'admin WordPress.

## Fichiers utiles

- `mini-golf-score-app/server.js` : API Express + stockage JSON
- `mini-golf-score-app/data/leaderboard.json` : scores enregistrés
- `mini-golf-score-app/public/index.html` : interface
- `mini-golf-score-app/public/app.js` : logique front
- `mini-golf-score-app/public/styles.css` : design mobile

## Déploiement WordPress

Pour un vrai déploiement avec WordPress en ligne, il faudra soit :

- héberger cette app sur un sous-domaine ou un petit hébergement Node séparé
- ou remplacer l'API Node par un backend compatible WordPress / Supabase / Firebase

Le prototype est surtout une base de test rapide et concrète.
