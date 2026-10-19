# Dalígotchi — Game Design Document

Version 0.1 — 19 octobre 2026

Ce document distingue les décisions validées, les recommandations et les paramètres ouverts. Il décrit le jeu complet avant de préciser la première version jouable (PVJ).

## 1. Pitch

Dalígotchi est un jeu dans lequel on s'occupe et élève un animal de compagnie en pixel art. Le joueur adopte des œufs, prend soin d’animaux autonomes, organise des rencontres et découvre de nouvelles formes au fil des générations. Les animaux créent également des occasions de rencontre entre joueurs.

L’expérience privilégie l’attachement, les soins, les relations et la découverte, sans condition de victoire définie. Elle vise environ quinze minutes de jeu par jour, pour un public d’environ dix ans et plus. Aucune monétisation n’est prévue.

La PVJ sera développée pour le Web, avec une interface adaptée au téléphone et une conception facilitant une future application mobile. La technologie n’est pas arrêtée. Une application web installable est une recommandation, pas une décision validée.

## 2. Boucle quotidienne

À l’ouverture, le joueur retrouve ses animaux occupés à vivre : dormir, marcher, manger, jouer ou interagir. Le temps s’est écoulé entre les sessions.

Une visite permet d’observer les besoins, nourrir et abreuver le foyer, nettoyer l’habitat, apporter une attention individuelle, s’occuper des œufs et gérer les rencontres ou les nouvelles pontes. Le joueur peut suivre la généalogie et accueillir de nouveaux animaux si des places sont disponibles.

La nourriture, l’eau et les soins sont toujours disponibles : aucun achat ni stock n’est nécessaire, mais le joueur doit appliquer les actions.

## 3. Foyer et partage

Chaque foyer dispose de **six places au total, animaux et œufs confondus**. Un œuf en incubation occupe déjà la place de l’animal à naître.

L’habitat est neutre et fantaisiste, sans contrainte aquatique ou de milieu. Toutes les espèces peuvent cohabiter. Une vue commune avec sélection individuelle est recommandée ; le cadrage sur téléphone reste à concevoir.

Un animal peut avoir plusieurs responsables et apparaître dans leurs foyers respectifs. Il possède un état unique : les soins effectués par un responsable bénéficient à tous. Ajouter un responsable ou transférer un animal exige l’accord de tous les responsables actuels. Les soins courants n’exigent pas d’accord collectif.

Recommandation à confirmer : l’animal partagé compte parmi les six places de chaque foyer concerné. La gestion des responsables durablement absents est volontairement reportée.

## 4. Cycle de vie

| Stade | Durée de référence | Reproduction |
|---|---|---|
| Œuf | 1 à 2 jours avec soins réguliers | Non |
| Jeune | 4 semaines | Non |
| Adulte | 9 semaines | Oui, sous conditions |
| Vieux | Environ 4 semaines | Non |

La vie après éclosion dure environ dix-sept semaines, soit quatre mois. Une légère variation héréditaire de longévité est prévue ; son amplitude et son effet sur les stades restent à définir. Les durées sont exprimées en temps réel de référence ; la vitesse exacte de simulation reste ouverte.

### Absence et mortalité

Les effets de l’absence sont plafonnés. Au retour, l’animal peut être affamé, assoiffé, triste ou sale, mais l’absence seule ne peut pas le tuer ni créer une dette de soins illimitée.

Les jeunes ne meurent pas. À partir du stade adulte, la mort est possible après des signes perceptibles de grande fatigue et/ou de maladie. Avant la vieillesse, des soins adaptés permettent toujours de l’éviter. À la vieillesse, les soins préservent le confort et peuvent prolonger légèrement la vie, mais la mort naturelle devient inévitable.

La mort survient seulement pendant une session. Pour un animal partagé, la présence d’un seul responsable suffit. Le décès constitue un événement unique ; les autres responsables en retrouvent les conséquences.

À préciser : durée des signes précurseurs, traitement du vieillissement pendant une longue absence et délai de retrouvailles évitant un décès immédiat à la reconnexion. La fatigue ordinaire doit être distinguée d’un état critique.

## 5. Besoins, états et commandes

Les animaux présentent des « besoins et états ». Les informations partagées aux joueurs sont textuelles, sans valeurs numériques visibles : « rassasié », « a faim », « très faim », « fatigué », etc.

Les dimensions prévues sont la faim, la soif, l’énergie, la santé, la propreté de l’animal, l’émotion, l’ennui et la propreté du foyer. L’âge relève du cycle de vie. L’amour est propre à chaque paire d’animaux, pas une jauge générale.

Un bouton **Actions** ouvre les interactions disponibles. Pour une action individuelle, le joueur choisit l’action puis l’animal concerné ou l'animal en premier et alors seuls les actions individuelles sont proposées.

| Action | Portée |
|---|---|
| Nourrir, abreuver, nettoyer l’habitat | Tout le foyer |
| Caresser, soigner | Animal sélectionné |
| Lancer une balle | Animal sélectionné ou foyer |
| Laver, couver un œuf | Œuf sélectionné |
| Laver un animal | Jeu complet ; fonctionnement à préciser |
| Organiser une rencontre | Animal et partenaire concernés |

Les animaux peuvent rester assis, marcher, manger, boire, jouer, réclamer du jeu, tourner en rond, faire leurs besoins, dormir, renifler et rencontrer leurs compagnons. Leur apparence et leurs animations expriment aussi maladie, bonheur, tristesse, colère, amour, faim, soif et saleté. Les priorités entre comportements restent à concevoir.

## 6. Œufs et incubation

Les œufs proviennent soit des animaux de joueurs, soit du jeu. Les œufs générés par le jeu sont des **fondateurs sans ascendants connus**, mais possèdent les caractères génétiques nécessaires.

Laver et couver font progresser l’incubation. Avec des soins réguliers, l’éclosion arrive en un à deux jours. L’absence retarde l’éclosion sans détruire l’œuf ni pénaliser définitivement le futur animal. L’efficacité et la fréquence des gestes restent à définir.

L’espèce et l’apparence sont découvertes à l’éclosion. L’ascendance peut toutefois rendre certains résultats prévisibles.

Après une ponte, les œufs restent dans un **nid partagé**, hors capacité des foyers et sans commencer leur incubation. Les responsables décident ensemble de confier chaque œuf à l’un d’eux, de l’adopter à plusieurs, de le proposer à un ami ou de le déposer au lieu d’adoption. L’entrée dans un foyer exige une place libre.

La capacité du nid, la durée d’attente et les accords lorsqu’un parent possède plusieurs responsables restent ouverts.

## 7. Espèces et génétique

### Espèces fondatrices et hybrides

Les six espèces fondatrices sont le renard, le hamster, le poulpe, le phoque, la tortue et le caméléon.

| Combinaison | Hybride |
|---|---|
| Renard + hamster | Hamstard |
| Renard + poulpe | Poulpard |
| Renard + phoque | Renoque |
| Renard + tortue | Tortard |
| Renard + caméléon | Camélard |
| Hamster + poulpe | Hamoulpe |
| Hamster + phoque | Hamoque |
| Hamster + tortue | Torter |
| Hamster + caméléon | Caméléster |
| Poulpe + phoque | Poulpoque |
| Poulpe + tortue | Tortoulpe |
| Poulpe + caméléon | Caméloulpe |
| Phoque + tortue | Tortoque |
| Phoque + caméléon | Caméloque |
| Tortue + caméléon | Tortéon |

### Transmission

Chaque animal porte deux allèles d’espèce parmi les six espèces fondatrices. Chaque parent transmet au hasard l’un des deux, avec une chance sur deux pour chacun. Deux allèles identiques donnent une espèce fondatrice ; deux différents donnent l’hybride correspondant. Aucun allèle « hybride » n’existe. Pour ce caractère, il n’y a pas de dominance.

Deux poulpards donnent ainsi, en moyenne, 25 % de renards, 50 % de poulpards et 25 % de poulpes. Ces proportions ne garantissent pas la composition d’une petite ponte.

Le GDD prévoit également une génétique de couleur, motifs et texture du corps, longévité, énergie et propensions à la maladie, à l’ennui, à l’émotion et à l’amour. Le principe est de deux allèles par gène, un transmis par chaque parent. Les règles de dominance et d’expression de ces autres caractères restent à définir.

Les allèles ne sont jamais visibles. Le joueur découvre les caractères par l’apparence, le comportement et la descendance.

### Généalogie

Chaque animal possède un arbre consultable permettant de remonter toutes les générations connues, jusqu’aux fondateurs sans ascendants. L’ascendance d’un œuf de joueur peut être consultée avant adoption. Une description de l'animal rédigée par son ou ses humains doit apparaitre dans cette généalogie.

Recommandation : conserver les animaux décédés et leurs caractères observables dans l’arbre, sans révéler les allèles. Les informations exactes et la navigation restent à concevoir.

## 8. Amour et reproduction

Les animaux n’ont pas de sexe. Ils peuvent avoir plusieurs partenaires au cours de leur vie. Mais l'amour est exclusif pendant une durée à déterminer, le seuil d'amour régressant en l'absence de l'autre animal. L’amour est distinct pour chaque paire et peut progresser spontanément dans un foyer ou lors de rencontres.

Les liens parent-enfant et entre frères et sœurs sont exclus de l’amour et de la reproduction. Inclure les demi-frères et demi-sœurs est recommandé ; les autres degrés de parenté restent à décider.

Une ponte est automatique lorsque les conditions suivantes sont réunies : les deux animaux sont adultes, le seuil d’amour est atteint, la parenté est autorisée, les deux parents ont terminé leur récupération et la ponte précédente de cette paire a été entièrement attribuée ou déposée au lieu d’adoption.

Une ponte produit **un à trois œufs, plus souvent un**. Chaque parent attend ensuite **deux semaines**, tous partenaires confondus, avant de pouvoir se reproduire à nouveau. Les vieux ne se reproduisent plus.

À définir : probabilités exactes, seuil et progression de l’amour, évolution après ponte et déclenchement hors connexion. Le maintien des conditions ne doit pas créer plusieurs fois la même ponte.

## 9. Rencontres asynchrones

Le joueur peut inviter l’animal d’une connaissance ou choisir un animal dans un lieu de rencontre.

1. Le premier joueur envoie une invitation.
2. Le second accepte, voit la rencontre et peut caresser les animaux ou jouer avec eux, même si le premier est déconnecté.
3. À sa prochaine connexion, le premier revoit la même rencontre. Il peut caresser et jouer, avec des réactions visuelles mais **sans nouveaux effets** sur l’état des animaux, l’amour ou les pontes.

La rencontre initiale a des conséquences appliquées une seule fois. Sa restitution est un souvenir. L’influence exacte des interventions initiales sur la relation reste à définir, de même que la disponibilité des animaux, les invitations concurrentes et leur expiration.

## 10. Lieu d’adoption

L’adoption est gratuite. Le lieu accueille les œufs déposés par les joueurs. Le jeu complète l’offre si elle est insuffisante, selon un ratio d’œufs disponibles par rapport au nombre de **joueurs récemment actifs**.

En cas de surplus, les plus anciens œufs peuvent être retirés automatiquement ; les œufs générés par le jeu le sont en priorité. La fenêtre d’activité, les ratios, les seuils et le retrait des œufs de joueurs restent à définir.

Recommandations : utiliser des seuils distincts pour l’ajout et le retrait ; maintenir les œufs sans incubation jusqu’à leur accueil ; empêcher deux adoptions simultanées du même œuf.

## 11. Espèces événementielles

Pendant une période définie, une proportion des nouveaux œufs donne une espèce rare, par exemple un corbeau à Halloween. Les pontes et les œufs générés par le jeu sont concernés.

La forme événementielle n’est pas héréditaire. L’animal conserve deux allèles cachés parmi les espèces fondatrices et transmet ceux-ci normalement. Il n’existe ni allèle corbeau ni hybride de corbeau. Un nouveau corbeau nécessite le mécanisme événementiel.

Recommandation : tirer la forme une seule fois à la création de l’œuf, sans nouveau tirage au dépôt ou à l’adoption, et conserver le résultat si l’éclosion arrive après l’événement. Les ratios et le calendrier restent à définir.

## 12. Communication et modération

Les messages accompagnent les rencontres, les adoptions et les décisions communes. Les inconnus utilisent des phrases prédéfinies. Les messages libres s’ouvrent après acceptation mutuelle d’une relation d’amitié. Un système de modération est requis.

Recommandations : signalement, blocage et traitement des signalements. Le blocage doit tenir compte des animaux et œufs partagés. Les règles et moyens de modération restent à définir avant ouverture des messages libres.

## 13. Graphisme

Le jeu utilise du pixel art aux pixels agrandis et nets. Des animations simples rendent lisibles les déplacements, les actions, les attitudes et les interactions. Les espèces doivent conserver des silhouettes distinctes, et les hybrides être reconnaissables.

La résolution, la palette, les tailles de sprites, les animations prioritaires et l’univers sonore restent à définir.

## 14. Première version jouable (PVJ)

### Choix explicitement validés

- Web en premier, avec adaptation mobile facilitée.
- Renard, poulpe et poulpard.
- Rencontres entre vrais joueurs.
- Nourrir, abreuver, nettoyer l’habitat, caresser, lancer une balle, laver et couver les œufs.
- Maladies et soins médicaux reportés.

### Ensemble fonctionnel recommandé, à confirmer

Pour tester une génération complète : foyer de six places, adoption, incubation, éclosion, besoins textuels, autonomie, évolution hors connexion, génétique d’espèce, rencontres asynchrones, amour, pontes et attribution des œufs.

Pour limiter la portée : phrases prédéfinies uniquement ; report des animaux partagés, messages libres, espèces événementielles, autres espèces et génétique détaillée hors espèce. Ces reports sont des recommandations, pas des validations individuelles acquises.

### Points d’attention

Sans maladies ni soins médicaux, la mort évitable des adultes doit être reportée ou redéfinie : aucun danger ne doit être introduit sans action permettant de le résoudre. La place de la vieillesse dans la PVJ reste ouverte.

Le cycle de quatre mois nécessite un temps accéléré pour les essais internes, sans changer automatiquement le rythme publié.

Les vrais joueurs, les rencontres et la reproduction nécessitent déjà des comptes et un état commun fiable : le Web facilite l’accès mais ne supprime pas cette complexité.

### Critères proposés pour les essais

- Un foyer plein reste gérable en environ quinze minutes par jour.
- Les besoins sont compris sans nombres affichés.
- Une absence ne tue pas et ne crée pas de dette de soins illimitée.
- Une éclosion respecte la limite de six places.
- Une rencontre et sa restitution ne doublent aucun effet.
- Une ponte respecte les deux semaines de récupération et n’est pas dupliquée.
- Les descendants suivent la transmission renard/poulpe.

## 15. Décisions à reprendre

Priorité avant réalisation : confirmer le périmètre global de la PVJ ; définir les besoins et l’incubation ; préciser la mort et le vieillissement hors connexion ; fixer la progression de l’amour et le déclenchement des pontes ; arrêter les accords d’attribution entre joueurs.

Paramètres d’équilibrage : probabilités de ponte, variation de longévité, génétique hors espèce, capacité du nid, ratios d’adoption et d’événements, fenêtre des joueurs actifs.

Sujets différés : responsables durablement absents, départ d’une coresponsabilité, conflits et blocage. Les modalités de modération et l’architecture Web/mobile restent à concevoir.

Le carnet des espèces découvertes reste une suggestion non validée.

### Compléments issus de la relecture

Deux règles restent à préciser : le dépôt d’un œuf au lieu d’adoption autorise-t-il définitivement son adoption par un tiers sans nouvel accord ; et comment la cohabitation dans plusieurs foyers fait-elle progresser les relations d’un animal partagé ? Ces points ne modifient pas les décisions déjà prises.
