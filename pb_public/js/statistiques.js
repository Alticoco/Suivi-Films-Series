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

// ---------- Équivalences : ce que représente tout ce temps passé devant l'écran ----------
// Chaque ligne : [phrase, valeur calculée à partir des minutes]. Le ton est volontairement un peu absurde.
const nombreFr = (n, decimales) => n.toLocaleString("fr-FR", { maximumFractionDigits: decimales === undefined ? 1 : decimales });
const pluriel = (n, un, plusieurs) => (Math.round(n * 10) / 10 <= 1 ? un : plusieurs);

function equivalences(minutes) {
  const heures = minutes / 60;
  const jours = heures / 24;
  const lignes = [
    ["En heures", `${nombreFr(heures, 0)} heure${heures >= 2 ? "s" : ""}`],
    ["En jours, sans dormir ni manger", `${nombreFr(jours)} ${pluriel(jours, "jour", "jours")} d'affilée`],
    ["En semaines de travail (35 h)", `${nombreFr(heures / 35)} ${pluriel(heures / 35, "semaine", "semaines")} de boulot à temps plein`],
    ["En mois", `${nombreFr(jours / 30.44)} mois non-stop`],
    ["En années", `${nombreFr(jours / 365.25, 2)} ${pluriel(jours / 365.25, "année", "années")} complète${jours / 365.25 >= 2 ? "s" : ""} passée${jours / 365.25 >= 2 ? "s" : ""} devant l'écran`],
    ["En nuits de sommeil (8 h)", `${nombreFr(heures / 8, 0)} nuits blanches transformées en séances ciné`],
    ["En vols Paris – New York (8 h)", `${nombreFr(heures / 8)} aller${heures / 8 >= 2 ? "s" : ""} simple${heures / 8 >= 2 ? "s" : ""}, sans escale`],
    ["En Seigneur des anneaux (versions longues, 11 h 26)", `${nombreFr(minutes / 686)} intégrale${minutes / 686 >= 2 ? "s" : ""} de la trilogie`],
    ["En marche à pied (5 km/h)", `${nombreFr(heures * 5, 0)} km, soit ${nombreFr((heures * 5) / 40075, 2)} tour${(heures * 5) / 40075 >= 2 ? "s" : ""} de la Terre`],
    ["Sur une vie de 80 ans", `${nombreFr((minutes / (80 * 525960)) * 100, 2)} % de ta vie entière`],
  ];
  return lignes;
}

function ouvrirEquivalences(titreTuile, minutes) {
  const fermer = el("button", { type: "button", class: "principal" }, "Fermer");
  const dialogue = el("dialog", { class: "dialogue-info" },
    el("h2", {}, "Ça fait combien, en vrai ?"),
    el("p", { class: "info-actuelle" }, `${titreTuile} : ${texteDuree(minutes)}`),
    minutes
      ? el("dl", { class: "liste-equivalences" }, equivalences(minutes).map(([libelle, valeur]) =>
        el("div", { class: "info-ligne" }, el("dt", {}, libelle), el("dd", {}, el("strong", {}, valeur)))))
      : el("p", { class: "discret" }, "Rien à convertir pour l'instant : aucun temps enregistré."),
    el("p", { class: "discret" }, "Estimations rigolotes, à ne pas montrer à ton médecin."),
    el("div", { class: "boutons-dialogue" }, fermer));
  fermer.addEventListener("click", () => dialogue.close());
  dialogue.addEventListener("click", (e) => { if (e.target === dialogue) dialogue.close(); });
  dialogue.addEventListener("close", () => dialogue.remove());
  document.body.append(dialogue);
  dialogue.showModal();
}

// Les trois tuiles de temps deviennent cliquables
function activerEquivalences() {
  [["temps-total", "Temps total passé", (b) => b.minutes_total], ["temps-films", "Temps devant des films", (b) => b.minutes_films],
    ["temps-episodes", "Temps devant des épisodes", (b) => b.minutes_episodes]].forEach(([id, titre, lire]) => {
    const tuile = document.getElementById(id).closest(".tuile");
    if (tuile.dataset.equivalences) return;
    tuile.dataset.equivalences = "1";
    tuile.classList.add("tuile-lien");
    tuile.setAttribute("role", "button");
    tuile.setAttribute("tabindex", "0");
    tuile.title = "Cliquer pour voir l'équivalence en jours, en années…";
    const ouvrir = () => ouvrirEquivalences(titre, lire(vue === "total" ? stats.total : stats.cette_annee));
    tuile.addEventListener("click", ouvrir);
    tuile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); } });
  });
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
    activerEquivalences();
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
