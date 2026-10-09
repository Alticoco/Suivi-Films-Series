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
  texte("titres-revus", bloc.revus);
  texte("note-periode", vue === "total"
    ? "Total : toutes les années, plus ce que j'ai vu avant la création du site (sans date). Pour un titre « vu avant », la durée est estimée : un film compte une fois, une série compte tous ses épisodes diffusés (hors spéciaux) qui ne sont pas cochés un par un. Le temps d'un épisode est sa durée connue, sinon la durée habituelle d'un épisode de la série."
    : `Année ${stats.annee_en_cours} : seulement les visionnages datés de cette année. Ce qui a été vu avant la création du site n'y figure pas (voir « Total »).`);
  document.getElementById("vues").replaceChildren(...[["annee", `Cette année (${stats.annee_en_cours})`], ["total", "Total"]].map(([cle, libelle]) =>
    el("a", { href: `statistiques.html?vue=${cle}`, class: `pastille-categorie${cle === vue ? " active" : ""}`, "aria-current": cle === vue ? "true" : null,
      onclick: (e) => { e.preventDefault(); vue = cle; history.replaceState(null, "", `?vue=${cle}`); afficherVue(); } }, libelle)));
}

// Coups de cœur : une petite affiche par titre, qui mène à sa fiche
async function afficherCoeurs() {
  const [titres, resumes] = await Promise.all([pbListe("titres"), chargerResumes(1200, () => {})]);
  const coeurs = titres.filter((t) => t.coup_de_coeur).sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  document.getElementById("nb-coeurs").textContent = coeurs.length;
  document.getElementById("bloc-coeurs").hidden = !coeurs.length;
  document.getElementById("coeurs").replaceChildren(...coeurs.map((t) => {
    const resume = t.source === "tmdb" ? resumes[`${t.format_source}:${t.id_source}`] : null;
    const adresse = urlImageTitre(t, resume ? resume.affiche : null, "w185");
    return el("a", { class: "coeur-carte", href: `fiche.html?id=${t.id}`, title: t.titre },
      adresse ? el("img", { src: adresse, alt: `Affiche de ${t.titre}`, loading: "lazy" }) : el("span", { class: "coeur-vide" }, t.titre),
      el("span", {}, t.titre));
  }));
}

async function demarrer() {
  const message = document.getElementById("message");
  try {
    stats = await chargerStatistiques();
    afficherAnnees(stats.par_annee);
    afficherVue();
    afficherCoeurs().catch(() => { /* les coups de cœur sont un plus : sans eux, le reste s'affiche quand même */ });
    document.getElementById("vues").hidden = false;
    message.hidden = true;
    document.getElementById("contenu").hidden = false;
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

demarrer();
