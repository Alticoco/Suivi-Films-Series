/// <reference path="../pb_data/types.d.ts" />

// Route "/api/perso/etat" : dit à la page d'accueil si le serveur tourne
// et si le jeton TMDB est présent. Le jeton lui-même n'est JAMAIS renvoyé.
routerAdd("GET", "/api/perso/etat", (e) => {
  let jetonPresent = false;
  try {
    const contenu = toString($os.readFile(`${__hooks}/../secrets/tmdb_token.txt`)).trim();
    jetonPresent = contenu.length > 20; // un vrai jeton est long
  } catch (erreur) {
    jetonPresent = false; // fichier absent
  }
  return e.json(200, { serveur: true, jeton_tmdb: jetonPresent });
});
