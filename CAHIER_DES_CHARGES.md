# Suivi Films & Séries — Cahier des charges V1

> Fichier de référence pour la réalisation dans Claude Code.
> Dépôt : https://github.com/Alticoco/Suivi-Films-Series (public, sans licence).

## 1. Le projet en deux phrases

Site perso, pour un seul utilisateur et un usage non commercial, qui tourne **en local sur mon PC Windows** et me sert à suivre les films, séries et animés que je regarde. Mon historique de visionnages m'appartient : il est stocké chez moi, exportable, et ne dépend d'aucun service externe. TMDB ne sert qu'à « habiller » les fiches (affiches, synopsis, dates).

## 2. Consignes de travail pour Claude Code

- Je suis débutant : **explique simplement** ce que tu fais et pourquoi, sans jargon inutile. Commentaires du code en français.
- Interface **entièrement en français**.
- Avance **étape par étape** (section 10). À la fin de chaque étape : je dois pouvoir tester dans mon navigateur, puis tu fais un commit avec un message clair.
- Ne jamais publier sur GitHub : la clé/le jeton TMDB, le dossier de données de PocketBase, les exports. Mets en place le `.gitignore` dès la première étape.
- Pas de dépendance inutile. Si une bibliothèque est nécessaire, copie-la dans le projet (pas de chargement depuis un CDN) pour que le site marche hors ligne.
- Le design doit être **facile à retoucher** : toutes les couleurs, polices et espacements dans des variables CSS regroupées en haut d'un seul fichier.
- Pose-moi une question avant tout choix important qui n'est pas tranché ici.

## 3. Choix techniques

| Sujet | Choix |
|---|---|
| Base de données + serveur | **PocketBase** (un seul exécutable, contient SQLite, interface d'admin incluse) |
| Interface | **HTML / CSS / JavaScript simple**, sans framework ni étape de compilation, servie par PocketBase (`pb_public/`) |
| Logique serveur | Hooks JavaScript de PocketBase (`pb_hooks/`) |
| Accès | Serveur lié à `127.0.0.1` uniquement (invisible depuis le réseau), port 8090 |
| Démarrage | **Manuel, par un raccourci sur le Bureau** : un double-clic lance PocketBase en arrière-plan (sans fenêtre, `127.0.0.1` uniquement) et ouvre le site dans le navigateur ; si PocketBase tourne déjà, il ouvre juste le site. Pas de démarrage automatique avec Windows. Un second raccourci « Arrêter » coupe le serveur |
| Comptes | Aucun. Un compte administrateur PocketBase créé une fois pour l'interface d'admin, c'est tout |
| Clé TMDB | Dans un fichier local non versionné, lue par le serveur. **Jamais envoyée au navigateur** : le navigateur passe par les routes du serveur |
| Export / import Excel | Bibliothèque type SheetJS, copiée localement |

## 4. Séparation des données

Deux mondes strictement séparés :

1. **Mes données** (définitives, jamais supprimées automatiquement) : quels titres j'ai ajoutés, leur type, statut, mes visionnages et leurs dates, mes notes et commentaires.
2. **L'habillage TMDB** (cache jetable) : synopsis, affiches, durées, listes d'épisodes, notes TMDB. Peut être vidé à tout moment sans rien perdre ; il se reconstruit tout seul.

### Source remplaçable

Toute communication avec TMDB passe par **un seul module** (ex. `pb_hooks/source/`) qui expose quelques fonctions neutres :

- `rechercher(texte)` → liste de résultats (films + séries)
- `details(type, idSource)` → infos d'un titre
- `saisons(idSource)` / `episodes(idSource, saison)` → structure d'une série

Le reste du code ne connaît pas TMDB. Plus tard, on pourra ajouter TVmaze, AniList ou Wikidata en écrivant un nouveau module, sans toucher à l'historique. Chaque titre garde la trace de sa source sous la forme `source` + `id_source` (ex. `tmdb` / `1399`).

## 5. Modèle de données (collections PocketBase)

### `titres` — mes titres

| Champ | Type | Remarques |
|---|---|---|
| `source` | texte | `tmdb` ou `manuel` |
| `id_source` | texte | vide si manuel |
| `format_source` | choix | `film` ou `serie` côté TMDB (un film et une série peuvent avoir le même numéro ; un animé peut être l'un ou l'autre). Vide si manuel |
| `type` | choix | `film`, `serie`, `anime` |
| `titre` | texte | titre français au moment de l'ajout (sert de repère dans l'export) |
| `annee` | nombre | année de sortie |
| `statut` | choix | `a_voir`, `en_cours`, `termine`, `en_pause`, `abandonne` |
| `vu_avant` | booléen | « vu avant la création du site », sans date |
| `coup_de_coeur` | booléen | coup de cœur (cœur sur l'affiche et sur la fiche, filtre « Coups de cœur » de la bibliothèque) |
| `note_serie` | nombre 0–10 | séries/animés uniquement, facultatif |
| `notes` | texte long | mes notes libres sur le titre |
| `duree_min` | nombre | uniquement pour les titres manuels (pour les stats) |
| `image_perso` | fichier | facultatif, surtout pour les titres manuels |

### `visionnages` — chaque visionnage

| Champ | Type | Remarques |
|---|---|---|
| `titre` | relation → `titres` | |
| `date` | date | date du jour par défaut, modifiable |
| `saison` | nombre | vide pour un film |
| `episode` | nombre | vide pour un film |
| `note` | nombre 0–10 | films uniquement, facultatif |
| `commentaire` | texte | films uniquement, facultatif |
| `avant` | booléen | « vu avant, date inconnue » : épisode vu avant la création du site, sans date (permet de dire « vu jusqu'à tel épisode » sans prétendre avoir tout vu) |
| `ajoute_le` | date (automatique) | quand la ligne a été enregistrée |
| `passage` | nombre | 1 (ou vide) = première fois, 2 = premier revisionnage d'une série, etc. |

- Convention technique : PocketBase stocke un nombre vide comme `0`. Une note `0` (ou `note_serie`, `annee`, `duree_min` à `0`) signifie donc « pas de note / inconnu ». Pour un film, `saison` et `episode` valent aussi `0` ; un épisode a toujours `episode` ≥ 1 (la saison `0` correspond aux épisodes spéciaux).
- **Film** : une ligne par visionnage. Revoir un film = une nouvelle ligne avec une nouvelle date (historique des revisionnages, temps écoulé entre deux visionnages affiché sur la fiche).
- **Série / animé** : une ligne par épisode coché. La « saison 0 » de TMDB (making-of, résumés, interviews, documentaires…) est présentée en dernier sous le nom « Bonus », repliée, et ne compte pas dans la progression. « Toute la saison » crée une ligne par épisode, avec la même date.
- Un épisode ne peut être coché qu'une fois **par passage**. « Revoir la série » ouvre un nouveau passage (épisodes à recocher, progression et statut propres à ce passage) ; les passages précédents restent consultables. Un film revu = une nouvelle ligne datée (bouton « Revu »).

### `cache_source` — habillage TMDB

`source`, `id_source`, `type_donnee` (détails, saison…), `donnees` (JSON), `recupere_le` (date).

### `reglages`

Un seul enregistrement : `dernier_export` (date).

## 6. Règles métier

### Statuts

- Ajout depuis la recherche : statut `a_voir` par défaut, ou « Vu » directement.
- **Film** : un visionnage ajouté → `termine`.
- **Série** : premier épisode coché → `en_cours`. Tous les épisodes déjà diffusés cochés → `termine`. Si une nouvelle saison sort, la série repasse `en_cours`.
- `en_pause` et `abandonne` se choisissent à la main. Cocher un nouvel épisode remet la série en `en_cours`.
- **Vu avant (série)** : deux façons. « Déjà vue en entier » marque tout le titre (statut `termine`). Pour une série vue en partie, on coche les épisodes avec « Vu avant, date inconnue » : ils sont enregistrés sans date (`avant`), comptent dans la progression (statut `en_cours` tant que ce n'est pas fini) mais pas dans le journal, le temps passé ni les années.
- **Vu avant** : marqueur sans date. Le titre compte comme vu (statut `termine`). Si je le revois plus tard, j'ajoute un visionnage daté normalement.

### Bouton « Vu » (films)

Ouvre une petite fenêtre : date (aujourd'hui par défaut), note /10 (facultative, choisie en cliquant sur 10 étoiles, demi-étoiles possibles), commentaire (facultatif), et une case « Vu avant, date inconnue ». Validation possible sans rien remplir.

### Type animé

Choisi au moment de l'ajout. Pré-sélectionné automatiquement si le titre TMDB est de genre Animation et d'origine japonaise ; je peux corriger.

## 7. Écrans

En-tête commun : navigation + barre de recherche (avec suggestions de titres pendant la frappe ; un clic ouvre directement la fiche du titre dans le catalogue). Pied de page : logo et mention TMDB.

1. **Tableau de bord** (accueil)
   - Derniers films vus et dernières séries vues, en deux carrousels de 5 affiches (le plus récent d'abord ; un titre « vu avant » compte à la date où il a été ajouté).
   - Séries en cours avec accès rapide « cocher l'épisode suivant ».
   - Bandeau de rappel de sauvegarde (voir §8).
   - Mini-stats : temps total passé en visionnage, nombre de titres vus cette année.
2. **Catalogue** — par défaut, on se balade dans des listes TMDB (tendances, films à l'affiche, populaires, mieux notés) avec un défilement infini d'affiches ; la recherche dans TMDB (films et séries) affiche ses résultats de la même façon. Un panneau **Filtres** permet de chercher un acteur (rôles principaux) ou un réalisateur par son nom, d'inclure (vert) ou d'exclure (rouge) des genres, des pays et des régions (ex. sans l'Asie, sans les États-Unis, seulement la France), de choisir films / séries (les filtres s'ajoutent à l'onglet choisi : par exemple « Séries les mieux notées » sans animation, sans l'Asie, etc. ; changer d'onglet garde les filtres), des thèmes (super-héros, zombies, voyage dans le temps, braquage…, inclus ou exclus), une période d'années et un tri ; les pays sont vérifiés d'après les vrais pays de production. Les mêmes filtres (sauf acteur et tri) s'appliquent aussi à une recherche par nom, pour retirer ce qui n'intéresse pas. Le pays s'affiche sous chaque affiche. Un clic sur une affiche ouvre une fenêtre de détail (synopsis, récapitulatif façon carte : année, box-office, studio, classification (un clic explique les classifications d'âge), score, pays, réalisateur, producteurs et acteurs avec photos (cliquables : un clic ouvre le catalogue avec tous les titres de la personne, y compris depuis la fiche d'un titre) ; les références du récapitulatif sont cliquables et ouvrent le catalogue sur tout ce qui les partage : année, studio (ou chaîne pour une série), pays, genres, et pour un film appartenant à une saga la liste des autres films de la saga (ex. Avatar 1, 2, 3) en un clic ; une bande « Titres similaires » (recommandations de TMDB d'après ce titre, pas d'après mes goûts), aussi sur la fiche d'un titre ; boutons d'ajout, date / note / commentaire pour « Vu »). Pour une série, la fenêtre permet de choisir la saison, de voir la liste des épisodes et de cocher ceux déjà vus (ou « toute la saison », « tout jusqu'à cette saison ») dès l'ajout. Une option « cocher aussi tous les épisodes précédents » (saisons et épisodes d'avant) existe aussi sur la fiche d'une série. Sur chaque résultat : « Ajouter à voir », « Vu », et un indicateur s'il est déjà dans ma bibliothèque. Un onglet **Sagas** liste les grandes sagas (Star Wars, James Bond, Le Seigneur des anneaux…) avec une recherche par nom ; une saga ouvre tous ses films dans l'ordre de sortie, avec un bouton « Marquer toute la saga comme vue » (films enregistrés « vu avant », sans date). Bouton **« Ajouter un titre manuellement »**.
3. **Ma bibliothèque** — grille d'affiches de mes titres.
   - Filtres : type (film / série / animé), statut, vu / pas vu, sélection « Coups de cœur ».
   - Tris : ma note, note TMDB, dernier visionnage, date d'ajout, titre, année.
4. **Fiche titre** — affiche, titre, année, synopsis, durée, note TMDB, statut (modifiable), notes libres.
   - Film : liste de mes visionnages (date, note, commentaire), temps écoulé entre deux visionnages, bouton « Vu ».
   - Série : saisons dépliables avec cases à cocher par épisode et bouton « toute la saison », progression (ex. S2E5), note de la série.
   - Possibilité de remplacer l'image, de supprimer le titre (avec confirmation).
5. **Journal** — tous mes visionnages par ordre chronologique inverse, regroupés par mois.
6. **Statistiques** — deux vues : « Cette année » et « Total » (toutes les années + ce qui a été vu avant, sans date, durée estimée). Temps passé (films + épisodes), nombre de films / séries / animés vus, titres revus, coups de cœur (avec leurs affiches), visionnages par année.
7. **Sauvegarde** — export, import, date du dernier export.

## 8. Sauvegarde : export et import

### Export Excel (.xlsx), lisible par un humain

- **Feuille « Historique »** : une ligne par visionnage — Titre, Année, Type, Date (jj/mm/aaaa), Saison, Épisode, Note, Commentaire, Statut actuel du titre.
- **Feuille « Mes titres »** : une ligne par titre — Titre, Année, Type, Statut, Vu avant, Coup de cœur, Note série, Notes, Durée (min) (colonne ajoutée : nécessaire pour ne pas perdre la durée des titres manuels).
- Les images ajoutées à la main (`image_perso`) ne sont pas dans l'export.
- Les titres « vu avant » apparaissent dans l'historique avec « Vu avant » à la place de la date.
- Une seule colonne technique, **en dernier** : `Identifiant` (ex. `tmdb:serie:1399`, `tmdb:film:603` ou `manuel:xxxx`), indispensable pour l'import.
- Nom du fichier : `suivi-films-series_AAAA-MM-JJ.xlsx`.

### Import

- Lit un fichier exporté par l'appli et reconstruit tous mes titres et visionnages ; l'habillage TMDB se recharge tout seul.
- Avant d'importer : aperçu (« X titres, Y visionnages ») et choix entre **remplacer tout** ou **fusionner** (sans créer de doublons).

### Rappel

Bandeau sur le tableau de bord si le dernier export date de **plus de 30 jours** (ou si aucun export n'a jamais été fait), avec un bouton « Exporter maintenant ».

## 9. Conditions TMDB à respecter

- Langue `fr-FR` : titres français, synopsis français avec **repli sur l'anglais** si vide, **affiches françaises en priorité** (puis sans texte, puis anglaises), **date de sortie en France** quand elle existe.
- Affiches chargées **directement depuis les serveurs d'images de TMDB**, en taille adaptée (petite pour la grille, moyenne pour la fiche) et en chargement différé. Elles ne sont pas stockées chez moi.
- Cache : données rafraîchies quand elles ont plus de 30 jours ; une tâche quotidienne supprime tout ce qui a plus de 6 mois. Bouton « Vider le cache TMDB » dans la page Sauvegarde (utile si la licence était coupée).
- Logo TMDB + mention en pied de page : « This product uses the TMDB API but is not endorsed or certified by TMDB. »
- Aucune fonction d'IA utilisant les données TMDB.

## 10. Ordre de réalisation

Chaque étape se termine par un test de ma part et un commit.

1. **Installation** — structure du projet, `.gitignore`, PocketBase, fichier local pour le jeton TMDB, raccourcis Bureau « Lancer » (démarre PocketBase en arrière-plan et ouvre le site) et « Arrêter », page d'accueil « ça marche ».
2. **Données** — création des collections et du module source TMDB (recherche, détails, saisons, cache).
3. **Catalogue** — recherche et ajout d'un titre (à voir / vu), ajout manuel.
4. **Fiche film** — bouton « Vu » avec date, note, commentaire, vu avant ; historique des visionnages.
5. **Fiche série** — épisodes à cocher, « toute la saison », progression, statuts automatiques.
6. **Ma bibliothèque** — grille, filtres, tris.
7. **Tableau de bord et statistiques**.
8. **Journal**.
9. **Sauvegarde** — export, import, rappel, vider le cache.
10. **Finitions visuelles** — je fournirai des captures de sites dont j'aime le style.

## 11. Hors V1 (versions suivantes)

- ~~Notes IMDb, Rotten Tomatoes et Metacritic via OMDb~~ : abandonné, la note TMDB suffit.
- Listes « à voir une fois dans sa vie » (meilleurs films, meilleures séries).
- Sources alternatives : TVmaze, AniList, Wikidata.
- Accès depuis le téléphone.
