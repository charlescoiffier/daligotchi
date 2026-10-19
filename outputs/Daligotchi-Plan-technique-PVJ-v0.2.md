# Dalígotchi — Plan technique de la PVJ

Version 0.2 — 19 octobre 2026 — accompagne le GDD v0.3

Ce document décrit comment construire la première version jouable (PVJ) : l'architecture, les technologies, le modèle de données, le déploiement et les étapes de réalisation. Les règles du jeu restent dans le GDD ; ce plan les traduit en choix techniques.

## 1. Objectifs et contraintes

- **Joueurs** : famille et amis invités, quelques dizaines de comptes au plus.
- **Plateforme** : application web installable (PWA), pensée d'abord pour le téléphone, utilisable sur tablette et ordinateur.
- **Serveur** : maison (option C), hébergé sur le VPS Hostinger existant.
- **Comptes** : pseudo + mot de passe, créés par l'administrateur, sans e-mail.
- **Langue** : français, textes séparés du code.
- **Équipe** : Claude écrit le code ; les enfants dessinent, inventent les règles et testent.
- **Fiabilité** : un état commun fiable (rencontres, pontes, adoptions), aucun effet appliqué deux fois.
- **Tests** : un temps accéléré pour parcourir un cycle de vie de quatre mois en quelques heures.

## 2. Principes d'architecture

### 2.1 Le serveur a le dernier mot

Le téléphone affiche et anime ; le serveur décide. Toute action qui change l'état (nourrir, couver, adopter, accepter une rencontre) est une requête au serveur, qui vérifie les règles et enregistre le résultat. Le téléphone ne peut pas tricher ni désynchroniser deux joueurs.

### 2.2 Une simulation « paresseuse »

Le serveur ne recalcule pas chaque animal chaque seconde. Il enregistre, pour chaque animal, **un instantané de son état et l'heure de cet instantané**. L'état actuel se calcule à la demande :

```
étatActuel = avancer(instantané, depuis = heureInstantané, jusqu'à = maintenant, contexte)
```

`avancer` est une fonction pure, déterministe, testable. Les plafonds d'absence du GDD la rendent simple : chaque besoin baisse jusqu'à un plancher et s'y arrête.

Après chaque action, le serveur calcule l'état actuel, applique l'action, puis enregistre le nouvel instantané.

### 2.3 Trois natures de choses

| Nature | Exemples | Où c'est calculé | Enregistré ? |
|---|---|---|---|
| **Décor** | marcher, renifler, tourner en rond, s'asseoir | sur le téléphone, à partir des besoins | Non |
| **État** | besoins, âge, interaction entre paires, incubation | fonction `avancer`, côté serveur (et côté téléphone pour l'affichage) | Oui, en instantanés |
| **Événements** | éclosion, ponte, rencontre, adoption, dépôt automatique, mort | serveur uniquement, dans une transaction | Oui, une seule fois |

### 2.4 Des règles partagées

Toutes les règles (besoins, cycle de vie, génétique, interaction, conditions de ponte) vivent dans un **module `core`** écrit en TypeScript, sans dépendance au réseau ni à la base. Il est utilisé :

- par le **serveur**, qui fait autorité ;
- par le **jeu**, pour afficher immédiatement l'état probable entre deux échanges avec le serveur ;
- par les **tests**, qui vérifient les règles du GDD.

Tous les nombres d'équilibrage sont réunis dans **un seul fichier** (`core/src/balance.ts`), lisible et modifiable par toute la famille.

### 2.5 L'horloge du monde

Le temps du jeu passe par une seule fonction `maintenantDuMonde()` côté serveur. Une **vitesse du monde** (`WORLD_SPEED`) multiplie l'écoulement du temps :

- `1` en production : quatre mois de vie réels ;
- `24` ou `100` en test : une journée de jeu par heure, ou plus vite.

La vitesse est fixée par environnement (variable d'environnement), jamais changée automatiquement en production.

## 3. Technologies retenues

| Domaine | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript 7** partout | Un seul langage, règles partagées entre serveur et jeu |
| Organisation | **Monorepo pnpm 12** (workspaces) | `core`, `server` et `client` dans un même dépôt |
| Exécution serveur | **Node.js 24 LTS** | Stable, maintenu longtemps |
| Framework serveur | **Fastify 5** | Léger, rapide, validation des requêtes intégrée |
| Validation | **Zod 4** | Mêmes schémas côté serveur et côté jeu |
| Base de données | **PostgreSQL 17** | Transactions solides : indispensable pour « une seule fois » |
| Accès base | **Drizzle ORM** + migrations Drizzle Kit, pilote postgres.js | SQL lisible, typé, migrations versionnées |
| Mots de passe | **argon2** (argon2id) | Standard actuel de hachage |
| Sessions | Cookie `httpOnly`, `Secure`, `SameSite=Lax`, sessions en base | Simple, sans jeton à stocker côté téléphone |
| Tâches de fond | Boucle planifiée dans le serveur (toutes les 5 minutes) | Pontes, dépôts après 7 jours, adoption ; pas de service supplémentaire |
| Construction du jeu | **Vite 8** | Démarrage instantané, PWA via `vite-plugin-pwa` |
| Habitat animé | **Phaser 4** (licence MIT, gratuit) | Sprites, animations, déplacements, rendu net du pixel art, son |
| Menus et écrans texte | **Preact 11** + CSS | Généalogie, rencontres, adoption : plus simple en HTML qu'en canvas |
| Textes traduisibles | `core/src/i18n/fr.json` + petite fonction `t()` | Partagés par le jeu, le serveur et le simulateur ; traduction future sans toucher au code |
| Tests | **Vitest 5** (règles et serveur), **Playwright** (parcours dans le navigateur) | Les critères d'essai du GDD deviennent des tests |
| Dessins | **Piskel** → planches PNG | Lues directement par Phaser (taille d'image fixe par planche) |
| Musiques | **BeepBox** → MP3 ou OGG | Joué par Phaser |
| Effets sonores | Enregistrements retravaillés avec **Audacity** → MP3 ou OGG | Joué par Phaser |
| Déploiement | **Docker Compose** : Caddy + serveur Node + Postgres | Une commande pour tout lancer, HTTPS automatique |

## 4. Organisation du code

```
daligotchi/
├── packages/
│   ├── core/                 # Règles du jeu, sans réseau ni base
│   │   ├── src/
│   │   │   ├── balance.ts    # Tous les nombres d'équilibrage
│   │   │   ├── clock.ts      # Vitesse du monde, conversions de durées
│   │   │   ├── random.ts     # Hasard injectable (reproductible dans les tests)
│   │   │   ├── needs.ts      # Besoins : baisse, planchers, niveaux
│   │   │   ├── lifecycle.ts  # Stades, vieillissement ralenti, signes de grand âge
│   │   │   ├── animal.ts     # Instantanés, avancer, actions, émotion, libellés
│   │   │   ├── genetics.ts   # Allèles d'espèce, transmission, nom de l'espèce
│   │   │   ├── simulation.ts # Simulateur d'une vie d'animal
│   │   │   ├── i18n/         # fr.json et t() : tous les textes du jeu
│   │   │   ├── bonds.ts      # (étape 6) Interaction, seuil d'amour, exclusivité, déclin
│   │   │   ├── breeding.ts   # (étape 6) Conditions de ponte, taille de ponte, parenté
│   │   │   └── incubation.ts # (étape 4) Progression des œufs
│   │   ├── sim/cli.ts        # Simulateur en ligne de commande (pnpm simulate)
│   │   └── test/
│   ├── server/               # API Fastify, base, tâches de fond
│   │   ├── src/
│   │   │   ├── db/           # Schéma Drizzle et migrations
│   │   │   ├── routes/       # auth, foyer, actions, œufs, rencontres, adoption, généalogie
│   │   │   ├── services/     # Logique transactionnelle (une seule fois)
│   │   │   ├── jobs/         # Tâches planifiées
│   │   │   └── admin/        # Scripts : créer un compte, réinitialiser un mot de passe
│   │   └── test/
│   └── client/               # Jeu web (PWA)
│       ├── src/
│       │   ├── game/         # Scènes Phaser : habitat, rencontre, éclosion, adieu
│       │   ├── ui/           # Écrans Preact : actions, fiche animal, généalogie, adoption
│       │   ├── behaviour/    # Choix des comportements décoratifs
│       │   └── api/          # Appels au serveur
│       └── public/
│           ├── sprites/      # Planches exportées de Piskel
│           └── audio/        # Musiques (BeepBox) et effets (Audacity)
├── piskel/                   # Sources des dessins (fichiers .piskel)
├── deploy/                   # docker-compose.yml, Caddyfile, configuration du VPS
├── scripts/                  # Outils locaux (Postgres du projet)
└── outputs/                  # GDD et plan technique, une version par fichier
```

## 5. Le module `core` (règles)

### 5.1 Besoins

- Chaque besoin a une valeur interne de 0 à 100, jamais affichée. Trois niveaux : **bien** (≥ 65), **moyen** (30 à 65 : « a faim »), **mauvais** (< 30 : « très faim »).
- Besoins stockés pour chaque animal :

| Besoin | Libellés | Évolution | Action qui le comble |
|---|---|---|---|
| Faim (`satiety`) | rassasié / a faim / très faim | −2,5 par heure | Nourrir (foyer) |
| Soif (`hydration`) | désaltéré / a soif / très soif | −2,5 par heure | Abreuver (foyer) |
| Énergie (`energy`) | en forme / fatigué / épuisé | **+4 par heure** (repos) | Baisse de 15 à chaque balle |
| Propreté (`hygiene`) | propre / sale / très sale | −0,75 par heure | Laver |
| Ennui (`fun`) | s'amuse / s'ennuie / s'ennuie beaucoup | −2,5 par heure | Balle (+35, moins si fatigué) |
| Affection (`affection`) | se sent aimé / réclame des câlins / se sent seul | −2 par heure | Caresser (+40) |
| Habitat (par foyer) | habitat propre / sale / très sale | −1,5 par heure | Nettoyer l'habitat |

- **L'émotion n'est pas stockée** : elle est déduite de la moyenne de tous les besoins, habitat compris (heureux ≥ 65, triste < 40, tranquille entre les deux).
- **La santé** n'est pas modélisée dans la PVJ, puisque les maladies sont reportées.
- **Plancher** : chaque besoin s'arrête à 5. L'absence ne crée donc ni mort ni dette illimitée.
- Avec ces valeurs, le simulateur confirme que **deux visites par jour** gardent l'animal heureux (lavage environ un jour sur deux), et qu'**une seule visite** le laisse « tranquille », avec faim et soif modérées.
- `describeAnimal` ne renvoie que des clés de textes (`need.satiety.low`…), jamais de nombres.

### 5.2 Cycle de vie et vieillissement ralenti

- L'animal porte un **âge biologique** (en durée), distinct de sa date de naissance.
- `avancer` fait progresser cet âge du temps écoulé, **multiplié par un facteur de ralentissement** pour la portion de temps située au-delà du seuil d'absence. Exemple de départ : facteur 0,5 après 2 jours sans visite d'un responsable.
- Le calcul se fait par morceaux : de l'instantané jusqu'à « dernière visite + seuil » à vitesse normale, puis au-delà à vitesse réduite.
- Les stades (jeune, adulte, vieux) se déduisent de l'âge biologique. La longévité héritée (plus tard) n'allonge ou ne raccourcit que la vieillesse.
- Exemple vérifié par le simulateur : une absence de 10 jours retarde la fin de vie de 4 jours.

### 5.3 Mort de vieillesse

- Au stade vieux, après un âge donné, l'animal entre dans une phase de **signes de grand âge** pendant plusieurs jours de jeu.
- À la fin de cette phase, la mort devient possible, mais elle est **déclenchée uniquement par le serveur pendant une session** d'un responsable, et jamais pendant la première session suivant une absence.
- Le décès est un événement enregistré une seule fois ; il déclenche la scène d'adieu chez chaque responsable à sa prochaine visite.

### 5.4 Génétique d'espèce

- Un génotype est une paire d'allèles parmi `renard | hamster | poulpe | phoque | tortue | caméléon`, triée pour que `[poulpe, renard]` et `[renard, poulpe]` soient identiques.
- `transmettre(parentA, parentB, aléa)` renvoie un allèle au hasard de chaque parent.
- `espèceVisible(génotype)` renvoie l'espèce fondatrice ou l'hybride du tableau du GDD.
- Œufs du jeu : deux allèles tirés au hasard parmi les espèces **actives** (PVJ : renard et poulpe).
- Le hasard est injecté (`aléa`) pour que les tests soient reproductibles.

### 5.5 Interaction et amour

- Une jauge par **paire** d'animaux (stockée avec l'identifiant le plus petit en premier).
- Hausses : temps passé ensemble (même foyer ou rencontre) et actions (balle au foyer, caresses et jeux en rencontre).
- Baisse lente quand les deux ne sont pas ensemble, sur plusieurs semaines.
- **Exclusivité** : si l'un des deux animaux est déjà amoureux d'un autre, la jauge de cette paire est plafonnée juste sous le seuil d'amour.
- Si deux paires d'un même animal franchissaient le seuil au même moment, la première arrivée l'emporte : le calcul traite les paires dans un ordre défini.

### 5.6 Conditions de ponte

`peutPondre(paire, contexte)` vérifie toutes les conditions du GDD :

- deux adultes ;
- seuil d'amour atteint ;
- parenté autorisée (pas de parent-enfant, frères et sœurs, ni demi-frères et demi-sœurs) ;
- récupération de deux semaines terminée pour chacun ;
- précédente ponte de la paire entièrement attribuée ou déposée.

`tailleDePonte(aléa)` renvoie 1, 2 ou 3, plus souvent 1 (probabilités dans `balance.ts`).

## 6. Le serveur

### 6.1 Points d'accès (API)

| Domaine | Points d'accès principaux |
|---|---|
| Comptes | `POST /auth/login`, `POST /auth/logout`, `GET /me` |
| Foyer | `GET /household` : animaux, œufs, places libres, état calculé, événements à montrer (éclosion, ponte, adieu, souvenir de rencontre) |
| Actions | `POST /actions` avec `{ action, cible }` : nourrir, abreuver, nettoyer, caresser, balle, laver animal, laver œuf, couver |
| Animaux | `GET /animals/:id`, `PATCH /animals/:id` (nom, description) |
| Généalogie | `GET /animals/:id/tree` |
| Nid | `GET /nest`, `POST /nest/:eggId/assign` (garder, confier à un ami, déposer) |
| Adoption | `GET /adoption`, `POST /adoption/:eggId/adopt` |
| Rencontres | `POST /meetings` (inviter), `POST /meetings/:id/accept`, `POST /meetings/:id/decline`, `POST /meetings/:id/interact`, `POST /meetings/:id/finish`, `GET /meetings/:id/replay` |
| Lieu de rencontre | `POST /meeting-place/listings`, `DELETE /meeting-place/listings/:id`, `GET /meeting-place` |
| Amis | `GET /friends`, `POST /friends/requests`, `POST /friends/requests/:id/accept` |
| Messages | `POST /messages` avec un identifiant de phrase prédéfinie |
| Administration | Scripts en ligne de commande, pas d'accès web |

Toutes les entrées sont validées par Zod. Toutes les routes, sauf la connexion, exigent une session.

### 6.2 « Une seule fois » : les garanties

| Risque | Protection |
|---|---|
| Ponte créée deux fois | Contrainte unique `(paire, numéro_de_ponte)` + transaction |
| Effets d'une rencontre appliqués deux fois | `UPDATE meetings SET effects_applied_at = now() WHERE id = ? AND effects_applied_at IS NULL` : seul celui qui modifie la ligne applique les effets |
| Même œuf adopté par deux joueurs | `UPDATE eggs SET household_id = ? WHERE id = ? AND status = 'available'` : une seule réussite possible |
| Septième place occupée | Verrou sur le foyer (`SELECT … FOR UPDATE`) et décompte des places dans la même transaction |
| Mort déclenchée deux fois | `died_at` renseigné une seule fois par mise à jour conditionnelle |
| Requête répétée (double tap, réseau instable) | Clé d'idempotence envoyée par le jeu pour chaque action |

### 6.3 Tâches de fond (toutes les 5 minutes)

1. **Pontes hors connexion** : parcourir les paires proches du seuil, calculer leur état, créer les pontes dues.
2. **Dépôt automatique** : déplacer vers le lieu d'adoption les œufs du nid non attribués depuis 7 jours, ce qui libère la paire.
3. **Lieu d'adoption** : ajouter des œufs du jeu si l'offre est sous le seuil bas, retirer les plus anciens (ceux du jeu d'abord) au-dessus du seuil haut.
4. **Invitations expirées** : les clore.

Chaque tâche est **rejouable sans risque** : elle s'appuie sur les mêmes garanties que ci-dessus. Un verrou consultatif Postgres empêche deux exécutions simultanées.

### 6.4 Comptes simplifiés

- Pas d'inscription publique. Script d'administration : `pnpm admin create-user <pseudo>` (génère ou demande un mot de passe) et `pnpm admin reset-password <pseudo>`.
- Mots de passe hachés avec argon2id ; limitation des tentatives de connexion.
- Les trois comptes de test sont créés par un script de données de test (`seed`) en développement et en environnement de test ; leurs identifiants restent dans un fichier local non publié.

## 7. Modèle de données (PVJ)

| Table | Contenu principal |
|---|---|
| `players` | id, pseudo (unique), hachage du mot de passe, dernière visite, date de création |
| `sessions` | id, joueur, expiration |
| `households` | id, joueur, état de propreté (instantané + heure) |
| `animals` | id, nom, description, génotype (2 allèles), forme visible, longévité, âge biologique, besoins (instantané JSON), heure de l'instantané, stade, phase de grand âge, `died_at`, parents A et B (nullables pour les fondateurs), ponte d'origine |
| `animal_owners` | animal, joueur, foyer (prépare les animaux partagés) |
| `eggs` | id, génotype, forme tirée à la création, parents, ponte d'origine, statut (`nest`, `household`, `available`, `hatched`, `removed`), foyer, progression d'incubation (instantané + heure), date d'entrée au nid |
| `pairs` | animal A, animal B (A < B), interaction (instantané + heure), dernière ponte, compteur de pontes |
| `clutches` | id, paire, numéro, date, nombre d'œufs ; unique `(paire, numéro)` |
| `meetings` | id, invitant, invité, animaux, statut, début et fin de scène, interactions (JSON), `effects_applied_at`, expiration |
| `meeting_listings` | animal inscrit au lieu de rencontre, date |
| `friendships` | joueur A, joueur B, statut |
| `messages` | expéditeur, destinataire, identifiant de phrase, contexte (rencontre, œuf) |
| `events` | journal des événements à montrer au joueur (éclosion, ponte, adieu, souvenir), marqué « vu » |
| `idempotency_keys` | clé, joueur, réponse, expiration |

Les animaux morts restent en base (généalogie). Les allèles ne sont jamais envoyés au jeu : le serveur ne renvoie que la forme visible et les caractères observables.

## 8. Le jeu (client)

### 8.1 Écrans

1. **Connexion** (pseudo + mot de passe).
2. **Habitat** (Phaser) : vue commune du foyer, animaux et œufs animés, bouton **Actions** toujours accessible.
3. **Panneau Actions** (Preact) : action puis cible, ou animal puis actions individuelles.
4. **Fiche animal** : libellés des besoins, stade, nom, description, accès à la généalogie.
5. **Généalogie** : arbre navigable, fondateurs, animaux décédés grisés.
6. **Nid** : œufs en attente, choix d'attribution, compte à rebours avant dépôt automatique.
7. **Lieu d'adoption** : œufs disponibles, ascendance consultable.
8. **Rencontres** : invitations reçues et envoyées, lieu de rencontre, **scène de rencontre** (Phaser), **souvenir** (replay sans effet).
9. **Scènes spéciales** : éclosion, nouvelle ponte, adieu.

### 8.2 Comportements décoratifs

Une petite « IA » sur le téléphone choisit toutes les quelques secondes ce que fait chaque animal, selon des poids liés à ses libellés : un animal qui « a faim » va plus souvent vers la gamelle ; un animal « fatigué » dort ; un animal qui s'ennuie réclame du jeu ou tourne en rond. Rien de tout cela n'est envoyé au serveur.

### 8.3 Affichage du pixel art

- Rendu Phaser en mode `pixelArt: true` (pas de lissage) et agrandissement par **multiples entiers** uniquement (×2 sur un téléphone courant, davantage sur un grand écran).
- Taille logique de l'habitat : 180 × 320 pixels en portrait (à confirmer).
- **Décor** (GDD §13) : pixel art gris léger sur fond blanc, sol marqué d'une légère trame avec quelques imperfections, nuages légers qui passent lentement. Seuls les animaux sont vraiment colorés.
- Polices pixel pour les titres, police lisible pour les textes longs.

### 8.4 PWA

- Installable depuis le navigateur (manifeste, icônes, écran de démarrage).
- Fichiers du jeu mis en cache pour un lancement rapide ; l'état vient toujours du serveur, le jeu ne fonctionne donc pas hors ligne.
- Pas de notifications push dans la PVJ.

### 8.5 Textes

Tous les textes visibles passent par `t('cle')` et vivent dans `core/src/i18n/fr.json`, partagé par le jeu, le serveur et le simulateur. Les libellés des besoins et les phrases prédéfinies sont identifiés par des clés, ce qui permettra une traduction future sans toucher au code.

## 9. Graphismes et son

### 9.1 Format

- Sprites de base d'environ **19 × 18 pixels** (format des recherches actuelles), exportés à l'échelle 1 ; l'agrandissement se fait dans le jeu.
- Une **planche** PNG par forme, par âge et par animation, exportée de Piskel (images de même taille côte à côte, comme la marche du renard : 8 images de 27 × 17 pixels). Phaser la découpe directement.
- Les fichiers sources `.piskel` sont conservés dans `piskel/`.
- Palette indexée : les couleurs pourront plus tard être échangées par le jeu pour la génétique de couleur, sans redessiner.

### 9.2 Liste des dessins de la PVJ

| Élément | Contenu |
|---|---|
| Formes | Renard, poulpe, poulpard |
| Âges | Jeune, adulte, vieux |
| Animations prioritaires | assis (respiration), marche, mange/boit, dort, content, triste/sale (expression), joue (balle) |
| Œuf | normal, sale, lavé, couvé, éclosion |
| Habitat | sol tramé, nuages, gamelle, eau, saletés, balle (gris léger sur fond blanc) |
| Scènes | cœurs (amour), adieu (étoile, nuage…) |
| Interface | icônes des actions, icônes des besoins |

Les enfants dessinent dans Piskel ; Claude intègre les planches et règle les animations.

### 9.3 Son

- **Musiques d'ambiance** composées dans BeepBox, **effets sonores** enregistrés puis retravaillés dans Audacity.
- Export en MP3 (lu partout) ; fichiers courts et légers, placés dans `client/public/audio/`.
- Lecture par Phaser : musique en boucle avec fondu entre les scènes, effets déclenchés par les actions et les événements.
- Le son n'est activé qu'après le premier toucher de l'écran (règle des navigateurs) ; les musiques sont chargées après l'affichage de l'habitat.
- Réglages : volume de la musique, volume des effets, bouton pour couper le son (mémorisés sur l'appareil).

## 10. Déploiement sur le VPS Hostinger

### 10.1 Services

```
Internet ──HTTPS──▶ Caddy ──▶ serveur Node (API + fichiers du jeu)
                                   │
                                   ▼
                              PostgreSQL (volume persistant)
```

- **Caddy** obtient et renouvelle automatiquement le certificat HTTPS.
- Le serveur Node sert à la fois l'API (`/api/…`) et les fichiers du jeu.
- Postgres n'est pas exposé sur Internet.

### 10.2 Environnements

| Environnement | Où | Vitesse du monde | Usage |
|---|---|---|---|
| Développement | Mac, Postgres propre au projet (`.data/`, port 5434) | réglable | Écriture du code |
| Test | VPS, sous-domaine `test.` | accélérée (ex. ×24) | Essais familiaux d'un cycle complet en quelques jours |
| Production | VPS, domaine principal | ×1 | Jeu réel avec les amis |

Test et production ont chacun leur propre base de données.

Le Mac de développement n'a pas de moteur Docker : les fichiers Docker seront vérifiés directement sur le VPS. `docker-compose.dev.yml` reste disponible pour un poste qui dispose de Docker.

### 10.3 Prérequis à vérifier sur le VPS

- Système, mémoire et espace disque disponibles ; Docker et Docker Compose installés ou installables.
- Un nom de domaine ou sous-domaine pointant vers le VPS.
- Accès SSH par clé.
- Ports 80 et 443 libres (ou un proxy existant à réutiliser).

### 10.4 Sauvegardes et mises à jour

- `pg_dump` quotidien, conservé 14 jours, copié hors du VPS (par exemple sur le Mac).
- Mise à jour : construction des images, migration de la base, redémarrage. Un script `deploy.sh` enchaîne ces étapes.

## 11. Tests

| Critère du GDD | Test automatique |
|---|---|
| Une absence ne tue pas, pas de dette illimitée | `avancer` sur 30 jours sans visite : besoins au plancher, animal vivant |
| Une longue absence ralentit le vieillissement | Âge biologique après 10 jours d'absence < 10 jours |
| Six places respectées | Éclosion, adoption et attribution refusées avec un foyer plein, y compris en requêtes simultanées |
| Rencontre et souvenir sans double effet | Deux validations concurrentes : un seul effet appliqué ; le souvenir ne change rien |
| Ponte : récupération et non-duplication | Tâche de fond lancée deux fois : une seule ponte ; pas de nouvelle ponte avant deux semaines |
| Dépôt automatique après sept jours | Œuf non attribué → lieu d'adoption, paire libérée |
| Exclusivité de l'amour | Animal amoureux : autre paire plafonnée sous le seuil |
| Transmission renard/poulpe | 10 000 croisements de poulpards : environ 25 / 50 / 25 % |
| Mort de vieillesse | Jamais hors session, jamais à la première session après une absence, une seule fois |
| Parcours complet | Playwright : connexion, nourrir, couver, éclosion (temps accéléré) |

Le **simulateur** (`pnpm simulate`) fait vivre un animal pendant toute sa vie en une seconde, avec 0, 1 ou 2 visites par jour et des absences, pour vérifier l'équilibrage. Ses scénarios principaux sont aussi des tests automatiques.

## 12. Étapes de réalisation

Chaque étape se termine par quelque chose de jouable ou de vérifiable par la famille.

| Étape | Contenu | Résultat visible | État |
|---|---|---|---|
| **0. Fondations** | Monorepo, Docker Compose local, Postgres, Fastify, Vite, tests en place | Une page « Dalígotchi » qui répond | ✅ fait |
| **1. Règles de base** | `core` : besoins, cycle de vie, génétique d'espèce, `avancer`, tests | Simulateur en ligne de commande | ✅ fait |
| **2. Comptes et foyer** | Connexion, foyer, 3 comptes de test, habitat Phaser avec un renard statique | Se connecter et voir son foyer | |
| **3. Soins** | Actions du foyer et individuelles, libellés, comportements décoratifs, animations, décor gris sur blanc | Un renard qui vit et qu'on soigne | |
| **4. Œufs et adoption** | Lieu d'adoption, incubation, éclosion, six places, tâche de réapprovisionnement | Adopter un œuf et le voir éclore | |
| **5. Mise en ligne de test** | Déploiement sur le VPS en vitesse accélérée, sauvegardes | La famille joue depuis ses téléphones | |
| **6. Relations** | Interaction et amour au foyer, ponte, nid, attribution, dépôt après 7 jours, généalogie | Premiers bébés et premier arbre | |
| **7. Rencontres** | Amis, invitations, lieu de rencontre, scène courte, souvenir, phrases prédéfinies | Rencontres entre joueurs | |
| **8. Fin de vie** | Grand âge, vieillissement ralenti, scène d'adieu | Cycle de vie complet | |
| **9. Finitions PVJ** | PWA installable, musiques et effets sonores, réglages d'équilibrage, production à vitesse ×1 | Ouverture aux amis | |

## 13. Points techniques à décider

- **Nom de domaine** et sous-domaine de test.
- **Caractéristiques du VPS** (à vérifier avant l'étape 5).
- **Taille logique de l'habitat** et cadrage sur téléphone.
- **Valeurs de départ** dans `balance.ts` : seront proposées à l'étape 1, puis ajustées avec le simulateur et les essais.
- **Hébergement du code** : dépôt Git privé (GitHub par exemple) recommandé dès l'étape 0, pour l'historique et les sauvegardes.

## Historique

- **v0.2 — 19 octobre 2026** : retour d'expérience des étapes 0 et 1 : versions réellement installées, textes déplacés dans `core`, modèle des besoins détaillé (affection, émotion déduite, énergie qui remonte), Piskel à la place d'Aseprite, son (BeepBox, Audacity), décor gris sur blanc, Postgres local du projet, simulateur.
- **v0.1 — 19 octobre 2026** : première version (conservée dans `Daligotchi-Plan-technique-PVJ-v0.1.md`).
