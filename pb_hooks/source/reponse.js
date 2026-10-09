// Petit utilitaire pour les routes : exécute "travail" avec la source et
// transforme le résultat (ou l'erreur) en réponse claire pour le navigateur.
function repondre(e, travail) {
  try {
    const resultat = travail(require(`${__hooks}/source/index.js`));
    if (resultat === null) return e.json(404, { message: "Introuvable" });
    return e.json(200, resultat);
  } catch (erreur) {
    console.log("Erreur source : " + String(erreur));
    return e.json(502, { message: String(erreur.message || erreur) });
  }
}

module.exports = { repondre };
