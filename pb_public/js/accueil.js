// Page d'accueil "ça marche" : demande au serveur son état et l'affiche.

function afficher(id, ok, texte) {
  const element = document.getElementById(id);
  element.textContent = (ok ? "✅ " : "❌ ") + texte;
  element.className = ok ? "ok" : "ko";
}

async function verifier() {
  try {
    const reponse = await fetch("/api/perso/etat");
    const etat = await reponse.json();
    afficher("etat-serveur", true, "en marche");
    afficher(
      "etat-tmdb",
      etat.jeton_tmdb,
      etat.jeton_tmdb ? "trouvé" : "absent (voir secrets/tmdb_token.exemple.txt)"
    );
  } catch (erreur) {
    afficher("etat-serveur", false, "ne répond pas");
    afficher("etat-tmdb", false, "inconnu");
  }
}

verifier();
