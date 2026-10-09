/// <reference path="../pb_data/types.d.ts" />

// Routes que le navigateur utilise pour parler à la "source" (TMDB).
// Le navigateur ne voit jamais le jeton : c'est le serveur qui appelle TMDB.
//
//   GET /api/source/rechercher?q=texte&page=1   (+ filtres facultatifs : type, genres_*, pays_*, annee_*)
//   GET /api/source/decouvrir?categorie=tendances&page=1   (se balader dans le catalogue)
//   GET /api/source/explorer?type=…&genres_inclus=…&pays_exclus=…  (parcourir avec des filtres)
//   GET /api/source/personnes?q=nom   (acteurs, réalisateurs... ; &metier= pour filtrer) ; explorer accepte personne_id + personne_role
//   GET /api/source/saga/{id}   (les films d'une saga : Avatar 1, 2, 3…)
//   GET /api/source/filtres, GET /api/source/pays?ids=film:603,…
//   GET /api/source/details/{format}/{id}      format = film | serie
//   GET /api/source/saisons/{id}
//   GET /api/source/episodes/{id}/{saison}
//   GET /api/source/resumes                    affiches + notes déjà en cache
//   GET /api/source/cache, DELETE /api/source/cache   taille du cache, vider le cache
//
// Note : dans PocketBase, chaque route est isolée (elle ne voit pas les
// fonctions écrites en haut de ce fichier). On charge donc les modules
// DANS chaque route avec require.

routerAdd("GET", "/api/source/rechercher", (e) => {
  const texte = (e.request.url.query().get("q") || "").trim();
  if (!texte) return e.json(400, { message: "Paramètre q manquant" });
  const q = e.request.url.query();
  const page = Math.max(1, Math.min(500, parseInt(q.get("page") || "1", 10) || 1));
  // Filtres facultatifs, pour retirer ce qui n'intéresse pas (mêmes noms que pour « explorer »)
  const filtres = {
    type: q.get("type") || "tous",
    genres_inclus: q.get("genres_inclus") || "", genres_exclus: q.get("genres_exclus") || "",
    pays_inclus: q.get("pays_inclus") || "", pays_exclus: q.get("pays_exclus") || "",
    annee_min: q.get("annee_min") || "", annee_max: q.get("annee_max") || "",
  };
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.rechercher(texte, page, filtres));
});

// Pour « se balader » : GET /api/source/decouvrir?categorie=tendances&page=2
routerAdd("GET", "/api/source/decouvrir", (e) => {
  const categorie = (e.request.url.query().get("categorie") || "tendances").trim();
  const page = Math.max(1, Math.min(500, parseInt(e.request.url.query().get("page") || "1", 10) || 1));
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.decouvrir(categorie, page));
});

// Les choix de filtres : GET /api/source/filtres
routerAdd("GET", "/api/source/filtres", (e) => {
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.filtres());
});

// Parcourir avec filtres : GET /api/source/explorer?type=film&genres_inclus=drame&pays_exclus=asie&page=1
routerAdd("GET", "/api/source/explorer", (e) => {
  const q = e.request.url.query();
  const parametres = {
    type: q.get("type") || "tous",
    genres_inclus: q.get("genres_inclus") || "", genres_exclus: q.get("genres_exclus") || "",
    pays_inclus: q.get("pays_inclus") || "", pays_exclus: q.get("pays_exclus") || "",
    annee_min: q.get("annee_min") || "", annee_max: q.get("annee_max") || "",
    tri: q.get("tri") || "populaires",
    personne_id: q.get("personne_id") || "", personne_role: q.get("personne_role") || "acteur",
    depuis_jours: Math.max(0, Math.min(365, parseInt(q.get("depuis_jours") || "0", 10) || 0)),
    themes_inclus: q.get("themes_inclus") || "", themes_exclus: q.get("themes_exclus") || "",
    societe_id: q.get("societe_id") || "", societe_type: q.get("societe_type") === "chaine" ? "chaine" : "studio",
    page: Math.max(1, Math.min(500, parseInt(q.get("page") || "1", 10) || 1)),
  };
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.explorer(parametres));
});

// Chercher une personne : GET /api/source/personnes?q=keanu
routerAdd("GET", "/api/source/personnes", (e) => {
  const texte = (e.request.url.query().get("q") || "").trim();
  const metier = e.request.url.query().get("metier") || ""; // facultatif : acteur, realisateur ou producteur
  if (!texte) return e.json(400, { message: "Paramètre q manquant" });
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.personnes(texte, metier));
});

// Titres similaires / recommandés : GET /api/source/similaires/film/603
routerAdd("GET", "/api/source/similaires/{format}/{id}", (e) => {
  const format = e.request.pathValue("format");
  const id = e.request.pathValue("id");
  if ((format !== "film" && format !== "serie") || !/^[0-9]+$/.test(id)) return e.json(400, { message: "Paramètres invalides" });
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.similaires(format, id));
});

// Les sagas : GET /api/source/sagas (les sagas connues) ou GET /api/source/sagas?q=star+wars (recherche)
routerAdd("GET", "/api/source/sagas", (e) => {
  const texte = (e.request.url.query().get("q") || "").trim();
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.sagas(texte));
});

// Les films d'une saga : GET /api/source/saga/{idCollection}
routerAdd("GET", "/api/source/saga/{id}", (e) => {
  const id = e.request.pathValue("id");
  if (!/^[0-9]+$/.test(id)) return e.json(400, { message: "Identifiant de saga invalide" });
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.saga(id));
});

// Pays de plusieurs titres : GET /api/source/pays?ids=film:603,serie:1399
routerAdd("GET", "/api/source/pays", (e) => {
  const ids = (e.request.url.query().get("ids") || "").split(",").filter((x) => x);
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.pays(ids));
});

routerAdd("GET", "/api/source/details/{format}/{id}", (e) => {
  const format = e.request.pathValue("format");
  if (format !== "film" && format !== "serie") return e.json(400, { message: "Format invalide" });
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) =>
    source.details(format, e.request.pathValue("id")));
});

routerAdd("GET", "/api/source/saisons/{id}", (e) => {
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) =>
    source.saisons(e.request.pathValue("id")));
});

routerAdd("GET", "/api/source/episodes/{id}/{saison}", (e) => {
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) =>
    source.episodes(e.request.pathValue("id"), e.request.pathValue("saison")));
});

// Affiches et notes de tout ce qui est déjà en cache (pour la bibliothèque)
routerAdd("GET", "/api/source/resumes", (e) => {
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.resumes());
});

// Cache : combien de lignes, et « Vider le cache TMDB » (page Sauvegarde)
routerAdd("GET", "/api/source/cache", (e) => {
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.infoCache());
});
routerAdd("DELETE", "/api/source/cache", (e) => {
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.viderCache());
});

// Tâche quotidienne (4 h du matin, si le PC est allumé) : vide le cache de plus de 6 mois.
cronAdd("nettoyage_cache", "0 4 * * *", () => {
  const supprimees = require(`${__hooks}/source/index.js`).nettoyerCache();
  console.log(`Nettoyage du cache : ${supprimees} ligne(s) supprimée(s)`);
});
