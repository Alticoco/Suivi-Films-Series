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

// Deux vues : l'année en cours, ou toute ma vie (toutes les années + ce que j'ai vu avant, sans date)
let stats = null;
let vue = new URLSearchParams(location.search).get("vue") === "total" ? "total" : "annee";

function afficherVue() {
  const bloc = vue === "total" ? stats.total : stats.cette_annee;
  const texte = (id, valeur) => { document.getElementById(id).textContent = valeur; };
  texte("temps-total", texteDuree(bloc.minutes_total));
  texte("temps-films", texteDuree(bloc.minutes_films));
  texte("temps-episodes", texteDuree(bloc.minutes_episodes));
  texte("etiquette-films", `devant des films (${bloc.films})`);
  texte("etiquette-episodes", `devant des épisodes (${bloc.episodes})`);
  texte("vus-film", bloc.titres_vus.film);
  texte("vus-serie", bloc.titres_vus.serie);
  texte("vus-anime", bloc.titres_vus.anime);
  document.getElementById("bloc-annees").hidden = vue !== "total";
  texte("note-periode", vue === "total"
    ? "Toute ma vie : toutes les années, plus ce que j'ai vu avant la création du site (sans date). Pour un titre « vu avant », la durée est estimée : un film compte une fois, une série compte tous ses épisodes diffusés (hors spéciaux) qui ne sont pas cochés un par un. Le temps d'un épisode est sa durée connue, sinon la durée habituelle d'un épisode de la série."
    : `Année ${stats.annee_en_cours} : seulement les visionnages datés de cette année. Ce qui a été vu avant la création du site n'y figure pas (voir « Toute ma vie »).`);
  document.getElementById("vues").replaceChildren(...[["annee", `Cette année (${stats.annee_en_cours})`], ["total", "Toute ma vie"]].map(([cle, libelle]) =>
    el("a", { href: `statistiques.html?vue=${cle}`, class: `pastille-categorie${cle === vue ? " active" : ""}`, "aria-current": cle === vue ? "true" : null,
      onclick: (e) => { e.preventDefault(); vue = cle; history.replaceState(null, "", `?vue=${cle}`); afficherVue(); } }, libelle)));
}

async function demarrer() {
  const message = document.getElementById("message");
  try {
    stats = await chargerStatistiques();
    afficherAnnees(stats.par_annee);
    afficherVue();
    document.getElementById("vues").hidden = false;
    message.hidden = true;
    document.getElementById("contenu").hidden = false;
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

demarrer();
