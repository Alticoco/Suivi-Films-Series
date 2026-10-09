# Synthèse du projet « Suivi Films & Séries »

> Document de reprise : à lire au début d'une nouvelle conversation pour retrouver tout le contexte.
> Référence fonctionnelle complète : `CAHIER_DES_CHARGES.md`. Design : `DESIGN.md`. Installation : `README.md`.

## 1. Le projet en deux phrases
Site perso, un seul utilisateur, qui tourne **en local sur Windows** (PocketBase + HTML/CSS/JS simples, sans framework) pour suivre films, séries et animés. Les données de l'utilisateur restent chez lui (base `pb_data/`), exportables en Excel ; TMDB ne sert qu'à « habiller » les fiches (affiches, synopsis, distribution…).

- Dépôt : https://github.com/Alticoco/Suivi-Films-Series (branche `main`, PR #1 à #13 fusionnés, aucun ouvert).
- Dossier : `E:\Projet IA\Suivi Films & Series`. Site : http://127.0.0.1:8090 — admin : http://127.0.0.1:8090/_/.
- L'utilisateur est **débutant** : toujours expliquer simplement, **en français** (interface, commentaires du code, messages).

## 2. Comment ça tourne
- Raccourcis Bureau « Suivi Films et Series » (lance PocketBase en arrière-plan, sans fenêtre, `127.0.0.1` seulement) et « Arreter… ». Pas de démarrage automatique avec Windows (choix de l'utilisateur).
- **Le serveur de l'utilisateur et le mien sont le même processus** : le redémarrer coupe son site quelques secondes. Les fichiers de `pb_hooks/` et `pb_migrations/` ne sont pris en compte qu'**au redémarrage** (commande de test utilisée : `pocketbase.exe serve --http=127.0.0.1:8090` en tâche masquée). Les fichiers de `pb_public/` sont servis tels quels (F5 suffit ; `Cache-Control: no-cache` posé par `pb_hooks/cache_navigateur.pb.js`).
- **Le site affiche les fichiers de la branche Git active** : changer de branche change ce que voit l'utilisateur.
- Jeton TMDB : `secrets/tmdb_token.txt` (jamais publié ; doit commencer par `eyJ`). Exclus de Git : `secrets/*` (sauf l'exemple), `pb_data/`, `pocketbase.exe`, `*.xlsx`.

## 3. Architecture (où est quoi)
```
pb_public/            le site : index (tableau de bord), catalogue, bibliotheque, fiche, journal, statistiques, sauvegarde (.html)
  css/variables.css   TOUTES les couleurs/polices/espacements (fond noir pur #000000, accent menthe, rouge « fauteuil de cinéma » pour les onglets, rouge d'erreur)
  css/style.css       styles (tout en variables)
  js/commun.js        en-tête + recherche avec menu « Filtrer » (Tout / Films / Séries / Acteurs / Réalisateurs / Producteurs) et suggestions titres + personnes, pied TMDB, utilitaires (el, source, pbListe, pbCreer…)
  js/formulaires.js   fenêtres, étoiles /10 (demi-étoiles), champs « Vu »
  js/catalogue.js     découverte à défilement infini, filtres inclure/exclure (puces vert/rouge), recherche acteur/réalisateur, fenêtre de détail, choix d'épisodes
  js/recapitulatif.js carte détaillée (studio, box-office, classification cliquable, pays, équipe, distribution, saga)
  js/serie.js         logique séries (progression, statuts auto, option « cocher les précédents »)
  js/fiche*.js        fiche film / série (bonus = « saison 0 » TMDB en bas, repliée)
  js/export.js import.js sauvegarde.js   Excel (SheetJS copié dans js/vendor/), import fusionner/remplacer
  fonts/ img/         Geist/Geist Mono et icônes Lucide copiées en local (aucun CDN : le site marche hors ligne)
pb_hooks/             logique serveur JavaScript PocketBase
  source/tmdb.js      SEUL fichier qui parle à TMDB (interface neutre : rechercher, decouvrir, explorer, details, episodes, personnes, filmographie, saga)
  source/index.js     cache (30 j, nettoyage à 6 mois) + filtre strict des pays
  perso/statistiques.js, source.pb.js (routes /api/source/*), etat.pb.js, perso.pb.js, cache_navigateur.pb.js
pb_migrations/        création/évolution automatique de la base
scripts/              lancer.vbs, arreter.vbs, creer-raccourcis.ps1
```
Collections : `titres` (dont `format_source`, `coup_de_coeur`, `vu_avant`), `visionnages` (dont `avant` = vu avant sans date, `ajoute_le`), `cache_source` (jetable), `reglages`.

## 4. Règles métier importantes (détails dans le cahier)
- Un nombre « vide » de PocketBase vaut 0 (note 0 = pas de note ; film : saison 0 / épisode 0 ; saison 0 = épisodes spéciaux/bonus).
- Statuts séries automatiques : 1er épisode coché → en cours ; tous les épisodes **diffusés** (hors spéciaux) cochés → terminé ; nouvel épisode → repasse en cours.
- « Vu avant » : titre entier (`titres.vu_avant`) **ou** épisodes isolés sans date (`visionnages.avant`) ; ils comptent dans la progression, pas dans journal/temps/années.
- Filtres de pays : **stricts** d'après les vrais pays de production (inclure = au moins un ; exclure = aucun, coproductions comprises). Les genres inclus se cumulent (tous) ; Horreur/Thriller/Romance/Histoire/Musique n'existent que pour les films.
- **Bibliothèque** : filtres avancés côté navigateur (genres inclus/exclus, régions/pays inclus/exclus, années), même principe de puces vert/rouge que le catalogue (`creerPuce` est dans `commun.js`). Les genres proposés sont ceux de MES titres (lus dans le cache TMDB via `resumes`, qui renvoie aussi `genres` et `pays` ; les fiches anciennes sans pays sont rechargées une à une). Adresse : `gi/ge/pi/pe/amin/amax`.
- **Statistiques** : deux vues, « Cette année » (visionnages datés de l'année) et « Toute ma vie » (`?vue=total` : tout, y compris le « vu avant » sans date, dont la durée est estimée : film = 1 fois, série = épisodes diffusés hors spéciaux non cochés un par un). Le serveur renvoie `cette_annee` et `total` ; les anciennes clés (`minutes_total`, `titres_vus`…) restent pour l'accueil.
- Export Excel : feuilles « Historique » et « Mes titres », colonne technique « Identifiant » en dernier (`tmdb:serie:1399`, `manuel:<id>`).

## 5. Ce qui a été fait (chronologie résumée)
1. Étapes 1 à 10 du cahier des charges (installation, données/TMDB, catalogue, fiches film/série, bibliothèque, tableau de bord + stats, journal, sauvegarde, finitions).
2. Évolutions demandées ensuite : catalogue « se balader » (défilement infini, catégories), fenêtre de détail, design **Token Mesh** (`DESIGN.md`) puis **fond noir pur**, notes en 10 étoiles (demi-étoiles), nav sur une ligne, épisodes cochables dès l'ajout d'une série, filtres inclure/exclure (genres, régions, pays, années, tri) y compris pendant une recherche par nom, carte récapitulative façon maquette, option « cocher aussi les épisodes précédents », coups de cœur, recherche acteur/réalisateur/producteur (champ des filtres et barre du haut : `?qp=nom&prole=…` liste les personnes, `?pers=id&prole=…` leur filmographie), menu « Filtrer » de la barre de recherche (choix gardé dans `localStorage`), onglets en rouge fauteuil de cinéma (`--couleur-onglet`), suggestions de recherche, info sur les classifications d'âge, bonus des séries, carrousels du tableau de bord (5 derniers films / séries), sagas (Avatar 1-2-3…), « vu avant » partiel, cache navigateur.
3. Les PR #1 à #13 sont **fusionnés dans `main`** (#12 : onglets rouges + recherche de personnes, route `personnes?q=&metier=`, rôle `producteur` ; #13 : filtres de la bibliothèque + statistiques « Toute ma vie »). Le suivi automatique des PR est activé (aucune CI n'est configurée sur le dépôt).

## 6. Façon de travailler (préférences de l'utilisateur et leçons)
- Un **PR par lot de modifications**, depuis une branche partant de `main` **à jour**, jamais empilés. Créer la branche *après* avoir fusionné ce dont elle dépend. Ne fusionner que quand l'utilisateur le demande (il le demande en général juste après).
- **Ne jamais toucher aux données de l'utilisateur** : il utilise le site pendant mes tests. Mes tests créent des titres préfixés (ex. « ZZ TEST ») et ne suppriment que **leurs propres identifiants** ; relever avant/après les identifiants et compteurs de `titres`/`visionnages`. Ne jamais lancer un import « remplacer tout » ni vider `titres`.
- Tester vraiment dans le navigateur intégré (outil `mcp__Claude_Browser__*`) : **mettre l'onglet au premier plan** (`tabs_select`) sinon le défilement infini, les images paresseuses et les captures échouent ; redimensionner puis **remettre `desktop`**.
- Scripts de modification de fichiers : les écrire avec l'outil d'écriture de fichiers (les gros heredocs `bash` avec accents graves/guillemets échouent), normaliser les fins de ligne (`split("\r\n").join("\n")`, Git convertit en CRLF), toujours vérifier la syntaxe JS après modification.
- Dans les routes PocketBase (`routerAdd`), **aucune fonction partagée en haut du fichier** n'est visible : charger les modules avec `require` à l'intérieur de chaque route.
- Avant de publier : contrôler qu'aucun jeton/base/exécutable n'est dans l'historique. Messages de commit en français avec la ligne `Co-Authored-By` fournie par l'environnement ; description de PR en français.
- Réponses : simples, structurées, sans jargon ; dire honnêtement ce qui a mal tourné (ex. branche créée sans une dépendance) et ce qui reste à faire.

## 7. Idées non réalisées / à proposer si l'utilisateur le souhaite
- Supprimer les anciennes branches fusionnées (locales et sur GitHub).
- Ajouter une vraie CI GitHub (vérification de syntaxe) si l'utilisateur voit « CI » comme manquant.
- V1.1 du cahier : notes IMDb/Rotten Tomatoes via OMDb, listes « à voir une fois dans sa vie », revisionnage complet d'une série, sources alternatives (TVmaze, AniList, Wikidata), accès téléphone.
- Séries ajoutées manuellement : pas de liste d'épisodes (seulement statut et note).
