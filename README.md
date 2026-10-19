# Dalígotchi

Jeu familial d'animaux de compagnie en pixel art. Le design est décrit dans `outputs/Daligotchi-GDD-v0.3.md` et l'architecture dans `outputs/Daligotchi-Plan-technique-PVJ-v0.2.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `packages/core` | Règles du jeu partagées (besoins, cycle de vie, génétique, textes, simulateur), sans réseau ni base |
| `packages/server` | API Fastify + PostgreSQL (Drizzle) |
| `packages/client` | Jeu web : Phaser (habitat) + Preact (menus) |
| `deploy` | Docker Compose, Caddy et configuration pour le VPS |
| `scripts` | Outils locaux (Postgres du projet) |

## Prérequis

- Node.js 24 (ou plus récent) et pnpm, activé avec `corepack enable pnpm`
- Les outils PostgreSQL 17 (`brew install postgresql@17`)

## Démarrer en local

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm db:init
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Le jeu s'ouvre sur http://localhost:5173 et l'API répond sur http://localhost:3000/api/health.

`pnpm db:seed` crée trois comptes de test (`essai1`, `essai2`, `essai3`), chacun avec un renard d'un âge différent. Leurs mots de passe sont écrits dans `.data/comptes-de-test.txt`, qui reste sur l'ordinateur et n'est jamais envoyé dans Git.

`pnpm db:init` crée un Postgres propre au projet dans `.data/` (port 5434, accessible uniquement en local). Après un redémarrage du Mac, il suffit de lancer `pnpm db:start`.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `pnpm test` | Tous les tests (core, serveur, client) |
| `pnpm typecheck` | Vérification des types |
| `pnpm simulate` | Fait vivre un animal toute sa vie en une seconde (options : `--visites 0\|1\|2`, `--jours`, `--absence 40:10`, `--longevite 1.1`, `--detail`) |
| `pnpm build` | Compile le jeu et le serveur |
| `pnpm db:generate` | Crée une migration après une modification de `packages/server/src/db/schema.ts` |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:stop` | Arrête le Postgres du projet |
| `pnpm db:seed` | Crée les 3 comptes de test (refusé en production) |
| `pnpm admin create-user <pseudo>` | Crée un joueur et son foyer ; affiche un mot de passe généré |
| `pnpm admin reset-password <pseudo>` | Donne un nouveau mot de passe à un joueur |
| `pnpm admin list-users` | Liste les joueurs et leur dernière connexion |

## Réglages

- `WORLD_SPEED` dans `.env` : `1` correspond au temps réel, `24` à une journée de jeu par heure.
- Les nombres d'équilibrage sont dans `packages/core/src/balance.ts`.
- Les textes du jeu sont dans `packages/core/src/i18n/fr.json`.

## Déploiement (VPS)

Copier `deploy/.env.example` en `deploy/.env`, le remplir, puis lancer depuis la racine du dépôt :

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Créer ensuite les comptes des joueurs depuis le VPS :

```bash
docker compose -f deploy/docker-compose.yml exec app node dist/admin.js create-user <pseudo>
```
