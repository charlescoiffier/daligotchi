# Dalígotchi

Jeu familial d'animaux de compagnie en pixel art. Le design est décrit dans `outputs/Daligotchi-GDD-v0.3.md` et l'architecture dans `outputs/Daligotchi-Plan-technique-PVJ-v0.1.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `packages/core` | Règles du jeu partagées (génétique, temps, équilibrage), sans réseau ni base |
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
pnpm dev
```

Le jeu s'ouvre sur http://localhost:5173 et l'API répond sur http://localhost:3000/api/health.

`pnpm db:init` crée un Postgres propre au projet dans `.data/` (port 5434, accessible uniquement en local). Après un redémarrage du Mac, il suffit de lancer `pnpm db:start`.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `pnpm test` | Tous les tests (core, serveur, client) |
| `pnpm typecheck` | Vérification des types |
| `pnpm build` | Compile le jeu et le serveur |
| `pnpm db:generate` | Crée une migration après une modification de `packages/server/src/db/schema.ts` |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:stop` | Arrête le Postgres du projet |

## Réglages

- `WORLD_SPEED` dans `.env` : `1` correspond au temps réel, `24` à une journée de jeu par heure.
- Les nombres d'équilibrage sont dans `packages/core/src/balance.ts`.
- Les textes du jeu sont dans `packages/client/src/i18n/fr.json`.

## Déploiement (VPS)

Copier `deploy/.env.example` en `deploy/.env`, le remplir, puis lancer depuis la racine du dépôt :

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```
