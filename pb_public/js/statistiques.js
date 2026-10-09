// Page Statistiques : temps passé, titres vus, visionnages par année.
// Les calculs sont faits par le serveur (/api/perso/statistiques).
// (Dépend de commun.js)

function texteDuree(minutes) {
  return minutes ? formatDuree(minutes) : "0 min";
}

function afficherAnnees(annees) {
  const zone = document.getElementById("annees");
  if (!annees.length) {
    zone.replaceChildren(el("p", { class: "discret" }, "Aucun visionnage daté pour l'instant."));
    return;
  }
  const maximum = Math.max(...annees.map((a) => a.films + a.episodes));
  // Années les plus récentes en haut
  zone.replaceChildren(...[...annees].reverse().map((a, rang) => {
    const total = a.films + a.episodes;
    const details = [];
    if (a.films) details.push(`${a.films} film${a.films > 1 ? "s" : ""}`);
    if (a.episodes) details.push(`${a.episodes} épisode${a.episodes > 1 ? "s" : ""}`);
    return el("div", { class: "ligne-annee" },
      el("strong", {}, String(a.annee)),
      el("div", { class: rang === 0 ? "barre barre-recente" : "barre", role: "img", "aria-label": `${total} visionnages en ${a.annee}` },
        el("div", { class: "barre-remplie", style: `width: ${Math.max(2, Math.round((total / maximum) * 100))}%` })),
      el("span", { class: "discret" }, `${details.join(" + ")} · ${texteDuree(a.minutes)}`));
  }));
}

async function demarrer() {
  const message = document.getElementById("message");
  try {
    const stats = await chargerStatistiques();
    document.getElementById("temps-total").textContent = texteDuree(stats.minutes_total);
    document.getElementById("temps-films").textContent = texteDuree(stats.minutes_films);
    document.getElementById("temps-episodes").textContent = texteDuree(stats.minutes_episodes);
    document.getElementById("vus-film").textContent = stats.titres_vus.film;
    document.getElementById("vus-serie").textContent = stats.titres_vus.serie;
    document.getElementById("vus-anime").textContent = stats.titres_vus.anime;
    afficherAnnees(stats.par_annee);
    message.hidden = true;
    document.getElementById("contenu").hidden = false;
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

demarrer();
