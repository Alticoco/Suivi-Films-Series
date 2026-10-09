// Tableau de bord : dernier film / dernière série vus, séries en cours
// (avec « cocher l'épisode suivant »), mini-statistiques, état du serveur.
// (Dépend de commun.js et serie.js)

// ---------- Petits outils ----------
function afficherEtat(id, ok, texte) {
  const element = document.getElementById(id);
  element.replaceChildren(icone(ok ? "check" : "x"), texte);
  element.className = ok ? "ok icone-texte" : "ko icone-texte";
}

function vignette(titre, affiche) {
  const adresse = urlImageTitre(titre, affiche, "w185");
  if (adresse) return el("img", { class: "vignette", src: adresse, alt: `Affiche de ${titre.titre}`, loading: "lazy" });
  const vide = el("div", { class: "vignette vignette-vide" }, "?");
  // Titre TMDB dont l'affiche n'est pas encore en cache : on la demande, puis on remplace le « ? »
  if (titre.source === "tmdb") {
    source(`details/${titre.format_source}/${titre.id_source}`).then((d) => {
      const url = urlAffiche(d.affiche, "w185");
      if (url) vide.replaceWith(el("img", { class: "vignette", src: url, alt: `Affiche de ${titre.titre}`, loading: "lazy" }));
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
    const actuel = derniers.get(v.titre);
    const cle = `${v.date}|${v.created}`;
    if (!actuel || cle > `${actuel.date}|${actuel.created}`) derniers.set(v.titre, v);
  }
  return derniers;
}

function carteDernier(titre, visionnage, affiche) {
  const precision = visionnage.episode > 0 ? ` · S${visionnage.saison}E${visionnage.episode}` : "";
  return el("a", { class: "dernier", href: `fiche.html?id=${titre.id}` },
    vignette(titre, affiche),
    el("div", {},
      el("strong", {}, titre.titre),
      el("p", { class: "discret" }, `Vu le ${formatDate(visionnage.date)}${precision}`),
      visionnage.note ? el("p", { class: "ma-note" }, icone("star"), String(visionnage.note)) : null));
}

function afficherDerniers(titres, visionnages, resumes) {
  const parId = new Map(titres.map((t) => [t.id, t]));
  const meilleur = { film: null, serie: null };
  for (const v of dernierVisionnageParTitre(visionnages).values()) {
    const t = parId.get(v.titre);
    if (!t) continue;
    const genre = estFilm(t) ? "film" : "serie";
    const actuel = meilleur[genre];
    if (!actuel || `${v.date}|${v.created}` > `${actuel.v.date}|${actuel.v.created}`) meilleur[genre] = { t, v };
  }
  const resume = (t) => (t.source === "tmdb" ? (resumes[`${t.format_source}:${t.id_source}`] || {}).affiche : null);
  for (const [genre, zoneId, vide] of [["film", "dernier-film", "Aucun film vu pour l'instant."], ["serie", "derniere-serie", "Aucune série vue pour l'instant."]]) {
    const zone = document.getElementById(zoneId);
    const choix = meilleur[genre];
    zone.replaceChildren(choix ? carteDernier(choix.t, choix.v, resume(choix.t)) : el("p", { class: "discret" }, vide));
  }
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
      const nouvelle = await cocherEpisodeSerie(titre.id, p.prochain.saison, p.prochain.episode);
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
    const [titres, visionnages, resumes] = await Promise.all([
      pbListe("titres"), pbListe("visionnages"), source("resumes").catch(() => ({})),
    ]);
    afficherDerniers(titres, visionnages, resumes);
    afficherEnCours(titres, visionnages, resumes);
  } catch (erreur) {
    for (const id of ["dernier-film", "derniere-serie", "en-cours"]) {
      document.getElementById(id).replaceChildren(el("p", { class: "ko" }, erreur.message));
    }
  }
}

demarrer();
