/// <reference path="../pb_data/types.d.ts" />

// Routes que le navigateur utilise pour parler à la "source" (TMDB).
// Le navigateur ne voit jamais le jeton : c'est le serveur qui appelle TMDB.
//
//   GET /api/source/rechercher?q=texte
//   GET /api/source/details/{format}/{id}      format = film | serie
//   GET /api/source/saisons/{id}
//   GET /api/source/episodes/{id}/{saison}
//
// Note : dans PocketBase, chaque route est isolée (elle ne voit pas les
// fonctions écrites en haut de ce fichier). On charge donc les modules
// DANS chaque route avec require.

routerAdd("GET", "/api/source/rechercher", (e) => {
  const texte = (e.request.url.query().get("q") || "").trim();
  if (!texte) return e.json(400, { message: "Paramètre q manquant" });
  return require(`${__hooks}/source/reponse.js`).repondre(e, (source) => source.rechercher(texte));
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

// Tâche quotidienne (4 h du matin, si le PC est allumé) : vide le cache de plus de 6 mois.
cronAdd("nettoyage_cache", "0 4 * * *", () => {
  const supprimees = require(`${__hooks}/source/index.js`).nettoyerCache();
  console.log(`Nettoyage du cache : ${supprimees} ligne(s) supprimée(s)`);
});
