/// <reference path="../pb_data/types.d.ts" />

// Routes qui calculent à partir de MES données :
//   GET /api/perso/statistiques    temps passé, titres vus, visionnages par année
// (Chaque route est isolée : on charge le module à l'intérieur avec require.)

routerAdd("GET", "/api/perso/statistiques", (e) => {
  try {
    return e.json(200, require(`${__hooks}/perso/statistiques.js`).calculer());
  } catch (erreur) {
    console.log("Erreur statistiques : " + String(erreur));
    return e.json(500, { message: String(erreur.message || erreur) });
  }
});
