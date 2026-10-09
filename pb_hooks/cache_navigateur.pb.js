/// <reference path="../pb_data/types.d.ts" />

// Les pages du site (HTML, CSS, JavaScript) changent souvent. Sans consigne, le navigateur peut garder
// longtemps une ancienne copie et afficher un site « pas à jour ». Avec « no-cache », il revérifie à chaque
// chargement : si rien n'a changé le serveur répond « inchangé » (très rapide), sinon il envoie la nouvelle version.
// (Les routes de l'API et l'administration PocketBase ne sont pas concernées.)
routerUse((e) => {
  const chemin = e.request.url.path || "";
  if (!chemin.startsWith("/api/") && !chemin.startsWith("/_/")) {
    e.response.header().set("Cache-Control", "no-cache");
  }
  return e.next();
});
