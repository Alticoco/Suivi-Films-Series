// Tableau de bord : dernier film / dernière série vus, séries en cours
// (avec « cocher l'épisode suivant »), mini-statistiques, état du serveur.
// (Dépend de commun.js et serie.js)

// ---------- Petits outils ----------
function afficherEtat(id, ok, texte) {
  const element = document.getElementById(id);
  element.replaceChildren(icone(ok ? "check" : "x"), texte);
  element.className = ok ? "ok icone-texte" : "ko icone-texte";
}

// "classe" : style de l'affiche (petite vignette par défaut, ou grande affiche de carrousel)
function vignette(titre, affiche, classe) {
  classe = classe || "vignette";
  const adresse = urlImageTitre(titre, affiche, "w185");
  if (adresse) return el("img", { class: classe, src: adresse, alt: `Affiche de ${titre.titre}`, loading: "lazy" });
  const vide = el("div", { class: `${classe} vignette-vide` }, "?");
  // Titre TMDB dont l'affiche n'est pas encore en cache : on la demande, puis on remplace le « ? »
  if (titre.source === "tmdb") {
    source(`details/${titre.format_source}/${titre.id_source}`).then((d) => {
      const url = urlAffiche(d.affiche, "w185");
      if (url) vide.replaceWith(el("img", { class: classe, src: url, alt: `Affiche de ${titre.titre}`, loading: "lazy" }));
    }).catch(() => {});
  }
  return vide;
}

// ---------- État du serveur (zone repliée en bas) ----------
async function verifierEtat() {
  try {
    const etat = await requete("/api/perso/etat");
    afficherEtat("etat-serveur", true, "en marche");
    afficherEtat("etat-tmdb", etat.jeton_tmdb, etat.jeton_tmdb ? "trouvé" : "absent ou invalide (voir secrets/tmdb_token.exemple.txt)");
    if (!etat.jeton_tmdb) document.querySelector(".etat-technique").open = true;
  } catch (erreur) {
    afficherEtat("etat-serveur", false, "ne répond pas");
    afficherEtat("etat-tmdb", false, "inconnu");
    document.querySelector(".etat-technique").open = true;
  }
}

// ---------- Mini-stats ----------
async function afficherMiniStats() {
  try {
    const stats = await chargerStatistiques();
    document.getElementById("stat-temps").textContent = stats.minutes_total ? formatDuree(stats.minutes_total) : "0 min";
    document.getElementById("stat-annee").textContent = String(stats.titres_vus_cette_annee);
    document.getElementById("stat-annee-libelle").textContent = `titre(s) vu(s) en ${stats.annee_en_cours}`;
  } catch (erreur) {
    document.getElementById("stat-temps").textContent = "—";
    document.getElementById("stat-annee").textContent = "—";
  }
}

// ---------- Derniers vus ----------
// Pour chaque titre : son visionnage le plus récent (date, puis ordre de création).
function dernierVisionnageParTitre(visionnages) {
  const derniers = new Map();
  for (const v of visionnages) {
    if (v.avant) continue; // « vu avant » : pas de date, traité à part (voir derniersVus)
    const actuel = derniers.get(v.titre);
    const cle = `${v.date}|${v.created}`;
    if (!actuel || cle > `${actuel.date}|${actuel.created}`) derniers.set(v.titre, v);
  }
  return derniers;
}

// Les derniers titres vus, séparés films / séries, du plus récent au plus ancien.
// Un titre « déjà vu avant » (sans date de visionnage) compte à la date où je l'ai ajouté.
function derniersVus(titres, visionnages, nombre) {
  const dernierParTitre = dernierVisionnageParTitre(visionnages);
  // Épisodes « vus avant » (sans date) : on retient l'ajout le plus récent et l'épisode le plus avancé
  const avantParTitre = new Map();
  for (const v of visionnages) {
    if (!v.avant) continue;
    const a = avantParTitre.get(v.titre) || { cree: "", saison: 0, episode: 0 };
    if ((v.ajoute_le || "") > a.cree) a.cree = v.ajoute_le || "";
    if (v.saison > a.saison || (v.saison === a.saison && v.episode > a.episode)) { a.saison = v.saison; a.episode = v.episode; }
    avantParTitre.set(v.titre, a);
  }
  const lignes = [];
  for (const titre of titres) {
    const visionnage = dernierParTitre.get(titre.id);
    const avant = avantParTitre.get(titre.id);
    if (visionnage) lignes.push({ titre, visionnage, cle: `${visionnage.date}|${visionnage.created}` });
    else if (avant) { // anciennes lignes sans date d'enregistrement : on prend la date d'ajout du titre
      const quand = avant.cree || titre.ajoute_le;
      lignes.push({ titre, visionnage: null, jusqua: `S${avant.saison}E${avant.episode}`, ajoute: quand, cle: quand });
    }
    else if (titre.vu_avant) lignes.push({ titre, visionnage: null, ajoute: titre.ajoute_le, cle: `${titre.ajoute_le}` });
  }
  lignes.sort((a, b) => (a.cle < b.cle ? 1 : -1));
  return {
    films: lignes.filter((l) => estFilm(l.titre)).slice(0, nombre),
    series: lignes.filter((l) => !estFilm(l.titre)).slice(0, nombre),
  };
}

function carteCarrousel(ligne, affiche, estLeDernier) {
  const { titre, visionnage } = ligne;
  const precision = visionnage && visionnage.episode > 0 ? ` · S${visionnage.saison}E${visionnage.episode}` : "";
  const quand = visionnage ? `Vu le ${formatDate(visionnage.date)}${precision}`
    : `Vu avant${ligne.jusqua ? ` · jusqu'à ${ligne.jusqua}` : ""} · ajouté le ${formatDate(ligne.ajoute)}`;
  return el("a", { class: "carrousel-carte", href: `fiche.html?id=${titre.id}`, role: "listitem" },
    el("span", { class: "carrousel-cadre" },
      vignette(titre, affiche, "carrousel-affiche"),
      estLeDernier ? el("span", { class: "carrousel-badge" }, "Dernier") : null),
    el("strong", { class: "carrousel-titre" }, titre.titre),
    el("span", { class: "discret carrousel-quand" }, quand),
    visionnage && visionnage.note ? el("span", { class: "ma-note" }, icone("star"), String(visionnage.note)) : null);
}

// Une rangée d'affiches qu'on fait défiler (flèches, molette, glisser au doigt, flèches du clavier).
function creerCarrousel(lignes, resume, vide, nomListe) {
  if (!lignes.length) return el("p", { class: "discret" }, vide);
  const piste = el("div", { class: "carrousel-piste", role: "list", "aria-label": nomListe, tabindex: "0" },
    lignes.map((ligne, i) => carteCarrousel(ligne, resume(ligne.titre), i === 0)));
  const precedent = el("button", { type: "button", class: "carrousel-bouton carrousel-precedent", "aria-label": "Voir les précédents" }, icone("arrow-left"));
  const suivant = el("button", { type: "button", class: "carrousel-bouton carrousel-suivant", "aria-label": "Voir les suivants" }, icone("arrow-right"));
  const defiler = (sens) => piste.scrollBy({ left: sens * Math.max(piste.clientWidth * 0.8, 160), behavior: "smooth" });
  precedent.addEventListener("click", () => defiler(-1));
  suivant.addEventListener("click", () => defiler(1));
  // Les flèches ne s'affichent que s'il y a quelque chose à voir de chaque côté
  const majFleches = () => {
    precedent.hidden = piste.scrollLeft <= 2;
    suivant.hidden = piste.scrollLeft + piste.clientWidth >= piste.scrollWidth - 2;
  };
  piste.addEventListener("scroll", majFleches, { passive: true });
  window.addEventListener("resize", majFleches);
  setTimeout(majFleches, 50);
  setTimeout(majFleches, 600); // une fois les affiches chargées
  return el("div", { class: "carrousel" }, precedent, piste, suivant);
}

function afficherDerniers(titres, visionnages, resumes) {
  const { films, series } = derniersVus(titres, visionnages, 5);
  const resume = (t) => (t.source === "tmdb" ? (resumes[`${t.format_source}:${t.id_source}`] || {}).affiche : null);
  document.getElementById("dernier-film").replaceChildren(creerCarrousel(films, resume, "Aucun film vu pour l'instant.", "Derniers films vus"));
  document.getElementById("derniere-serie").replaceChildren(creerCarrousel(series, resume, "Aucune série vue pour l'instant.", "Dernières séries vues"));
}

// ---------- Séries en cours ----------
function lignePourSerie(titre, affiche) {
  const infos = el("p", { class: "discret" }, "Chargement des épisodes…");
  const action = el("div", { class: "action-suivant" });
  const ligne = el("li", { class: "serie-en-cours" },
    vignette(titre, affiche),
    el("div", { class: "serie-infos" }, el("a", { href: `fiche.html?id=${titre.id}` }, el("strong", {}, titre.titre)), infos),
    action);
  return { ligne, infos, action };
}

// Affiche la progression d'une série et le bouton pour cocher l'épisode suivant.
function majLigneSerie(elements, titre, saisons, siens) {
  const p = calculerProgression(saisons, siens);
  const debut = p.dernier ? `S${p.dernier.saison}E${p.dernier.episode}` : "pas encore commencée";
  elements.infos.textContent = p.prochain
    ? `${debut} · prochain : S${p.prochain.saison}E${p.prochain.episode}${p.prochain.nom ? ` « ${p.prochain.nom} »` : ""}`
    : `${debut} · à jour (en attente de nouveaux épisodes)`;
  elements.action.replaceChildren();
  if (!p.prochain) return;
  const bouton = el("button", { type: "button", class: "principal" }, icone("check"), `S${p.prochain.saison}E${p.prochain.episode}`);
  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    try {
      const nouvelle = await cocherEpisodeSerie(titre.id, p.prochain.saison, p.prochain.episode, undefined, false, passageActuelDe(siens));
      siens.push(nouvelle);
      const apres = calculerProgression(saisons, siens);
      const statut = apres.complet ? "termine" : "en_cours";
      if (statut !== titre.statut) titre = await pbModifier("titres", titre.id, { statut });
      if (titre.statut === "termine") {
        toast(`« ${titre.titre} » est terminée !`);
        elements.ligne.remove();
        if (!document.querySelector(".serie-en-cours")) afficherAucuneSerie();
        return;
      }
      majLigneSerie(elements, titre, saisons, siens);
    } catch (erreur) {
      toast(erreur.message, true);
      bouton.disabled = false;
    }
  });
  elements.action.append(bouton);
}

function afficherAucuneSerie() {
  document.getElementById("en-cours").replaceChildren(el("p", { class: "discret" }, "Aucune série en cours."));
}

async function afficherEnCours(titres, visionnages, resumes) {
  const zone = document.getElementById("en-cours");
  const series = titres.filter((t) => !estFilm(t) && t.statut === "en_cours");
  if (!series.length) return afficherAucuneSerie();

  const liste = el("ul", { class: "liste-series" });
  zone.replaceChildren(liste);
  for (const titre of series) {
    const affiche = titre.source === "tmdb" ? (resumes[`${titre.format_source}:${titre.id_source}`] || {}).affiche : null;
    const elements = lignePourSerie(titre, affiche);
    liste.append(elements.ligne);
    if (titre.source !== "tmdb") {
      elements.infos.textContent = "Titre manuel : pas de liste d'épisodes.";
      continue;
    }
    const siens = visionnages.filter((v) => v.titre === titre.id);
    chargerSaisons(titre.id_source)
      .then((saisons) => majLigneSerie(elements, titre, saisons, siens))
      .catch((erreur) => { elements.infos.textContent = `Épisodes indisponibles : ${erreur.message}`; });
  }
}

// ---------- Rappel de sauvegarde ----------
// Bandeau si le dernier export date de plus de 30 jours, ou s'il n'y en a jamais eu
// (et seulement si j'ai déjà des données à sauvegarder).
async function afficherRappelSauvegarde() {
  try {
    const [date, premiers] = await Promise.all([dateDernierExport(), requete("/api/collections/titres/records?perPage=1")]);
    if (!premiers.totalItems) return;
    const jours = joursDepuis(date);
    if (date && jours <= 30) return;
    document.getElementById("texte-rappel").textContent = date
      ? `Ton dernier export date d'il y a ${jours} jours. Pense à sauvegarder tes données.`
      : "Tu n'as encore jamais exporté tes données. Pense à faire une sauvegarde.";
    const bouton = document.getElementById("bouton-rappel");
    bouton.addEventListener("click", async () => {
      bouton.disabled = true;
      try {
        const bilan = await exporterMaintenant();
        toast(`${bilan.nomFichier} : ${bilan.titres} titre(s), ${bilan.visionnages} visionnage(s) exportés.`);
        document.getElementById("rappel-sauvegarde").hidden = true;
      } catch (erreur) {
        toast(erreur.message, true);
        bouton.disabled = false;
      }
    });
    document.getElementById("rappel-sauvegarde").hidden = false;
  } catch (erreur) { /* le rappel est facultatif : on ne gêne pas le reste de la page */ }
}

// ---------- Démarrage ----------
async function demarrer() {
  document.querySelector(".tuile-lien .tuile-valeur").replaceChildren(icone("arrow-right"));
  verifierEtat();
  afficherRappelSauvegarde();
  afficherMiniStats();
  try {
    const [titres, visionnages] = await Promise.all([pbListe("titres"), pbListe("visionnages")]);
    // On n'attend pas les affiches plus de 1,2 s : mes données s'affichent tout de suite
    const resumes = await chargerResumes(1200, (tard) => afficherDerniers(titres, visionnages, tard));
    afficherDerniers(titres, visionnages, resumes);
    afficherEnCours(titres, visionnages, resumes);
  } catch (erreur) {
    for (const id of ["dernier-film", "derniere-serie", "en-cours"]) {
      document.getElementById(id).replaceChildren(el("p", { class: "ko" }, erreur.message));
    }
  }
}

demarrer();
