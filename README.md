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