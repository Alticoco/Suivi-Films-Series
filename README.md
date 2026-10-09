# Suivi Films & Séries

Site perso, pour un seul utilisateur, qui tourne **en local sur mon PC Windows** et sert à suivre les films, séries et animés que je regarde. Mes données restent chez moi (base PocketBase), exportables en Excel. TMDB ne sert qu'à « habiller » les fiches (affiches, synopsis, dates).

Le détail du projet est dans [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md).

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## Installation (première fois)

1. **PocketBase** : télécharger la version Windows sur <https://github.com/pocketbase/pocketbase/releases> et placer `pocketbase.exe` à la racine du projet (ce fichier n'est pas versionné).
2. **Jeton TMDB** : créer le fichier `secrets/tmdb_token.txt` contenant uniquement le « jeton d'accès en lecture à l'API » de TMDB (voir `secrets/tmdb_token.exemple.txt`). Ce fichier n'est jamais publié.
3. **Raccourcis Bureau** : exécuter `scripts/creer-raccourcis.ps1` (clic droit → *Exécuter avec PowerShell*). Cela crée deux raccourcis sur le Bureau.

## Utilisation

| Action | Comment |
|---|---|
| Lancer le site | Double-clic sur le raccourci **Suivi Films et Series** (démarre PocketBase en arrière-plan, sans fenêtre, puis ouvre <http://127.0.0.1:8090>) |
| Arrêter le site | Double-clic sur **Arreter Suivi Films et Series** |
| Administration de la base | <http://127.0.0.1:8090/_/> (compte administrateur créé à la première ouverture) |

Le serveur n'écoute que sur `127.0.0.1` : il n'est pas visible depuis le réseau. Il ne démarre pas tout seul avec Windows.

## Sauvegarde

Page **Sauvegarde** du site : export Excel (`.xlsx`), import (fusionner ou remplacer tout) et vidage du cache TMDB. Un bandeau de rappel s'affiche sur le tableau de bord si le dernier export date de plus de 30 jours.

## Organisation du projet

```
pb_public/        le site (HTML / CSS / JavaScript simples, sans framework)
  css/variables.css   toutes les couleurs, polices et espacements (à modifier pour changer le design)
  js/icones.js        icônes (jeu Lucide)
  js/vendor/          bibliothèque tierce copiée localement (SheetJS, licence Apache 2.0)
  fonts/              polices Geist et Geist Mono copiées localement (licence OFL), voir fonts/LISEZ-MOI.txt
  img/                logo TMDB, icône de l'onglet
pb_hooks/         logique serveur (JavaScript PocketBase)
  source/             module TMDB (seul endroit qui parle à TMDB) + cache
  perso/              statistiques
pb_migrations/    création automatique des collections de la base
scripts/          lancement, arrêt, création des raccourcis
secrets/          jeton TMDB (non versionné, sauf le fichier d'exemple)
pb_data/          base de données (non versionnée, créée automatiquement)
```

## Design

Le style suit le système « Token Mesh » décrit dans [`DESIGN.md`](DESIGN.md) : fond ardoise sombre, police Geist (chiffres en Geist Mono), une seule couleur d'accent (menthe), pas de dégradé ni d'émoji. Les valeurs sont centralisées dans `pb_public/css/variables.css`.

## Ce qui n'est jamais publié sur GitHub

Le jeton TMDB (`secrets/tmdb_token.txt`), le dossier `pb_data/` (ma base), les exports `.xlsx` et `pocketbase.exe` sont exclus par le `.gitignore`.
