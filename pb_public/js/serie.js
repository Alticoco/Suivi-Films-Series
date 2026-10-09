// Logique « série » partagée entre la fiche et le tableau de bord :
// charger les saisons, calculer la progression, cocher l'épisode suivant.
// (Dépend de commun.js : source, dateDuJour, pbCreer, pbModifier)
//
// Rappel des données : un épisode coché = une ligne « visionnages » (saison, episode, date).
// La saison 0 = les épisodes spéciaux : on peut les cocher, mais ils ne comptent pas
// dans la progression ni pour savoir si la série est terminée.

const cleEpisode = (saison, episode) => `${saison}:${episode}`;

// Un épisode est « diffusé » si sa date est connue et passée.
const estDiffuse = (episode) => !!episode.date_diffusion && episode.date_diffusion <= dateDuJour();

// Charge toutes les saisons d'une série TMDB avec leurs épisodes (4 appels à la fois ;
// le serveur garde tout en cache ensuite).
async function chargerSaisons(idSource) {
  const details = await source(`details/serie/${idSource}`);
  const saisons = details.saisons.map((s) => Object.assign({}, s, { episodes: [] }));
  const file = [...saisons];
  const ouvrier = async () => {
    while (file.length) {
      const saison = file.shift();
      saison.episodes = (await source(`episodes/${idSource}/${saison.numero}`)) || [];
    }
  };
  await Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()]);
  return saisons;
}

// Épisodes déjà cochés : Map "saison:episode" → ligne « visionnages »
function episodesVusDe(visionnagesTitre) {
  return new Map(visionnagesTitre.filter((v) => v.episode > 0).map((v) => [cleEpisode(v.saison, v.episode), v]));
}

// Tout ce dont on a besoin pour la progression et les statuts.
function calculerProgression(saisons, visionnagesTitre) {
  const vus = episodesVusDe(visionnagesTitre);
  let diffuses = 0;
  let diffusesVus = 0;
  let prochain = null; // premier épisode diffusé, hors spéciaux, pas encore vu
  for (const saison of saisons) {
    if (saison.numero === 0) continue;
    for (const episode of saison.episodes) {
      if (!estDiffuse(episode)) continue;
      diffuses++;
      if (vus.has(cleEpisode(saison.numero, episode.numero))) diffusesVus++;
      else if (!prochain) prochain = { saison: saison.numero, episode: episode.numero, nom: episode.nom };
    }
  }
  // Dernier épisode vu (hors spéciaux) : la plus grande saison, puis le plus grand épisode
  let dernier = null;
  for (const v of vus.values()) {
    if (v.saison === 0) continue;
    if (!dernier || v.saison > dernier.saison || (v.saison === dernier.saison && v.episode > dernier.episode)) dernier = v;
  }
  return { vus, total: vus.size, diffuses, diffusesVus, prochain, dernier, complet: diffuses > 0 && diffusesVus === diffuses };
}

// Coche un épisode (à la date donnée, aujourd'hui par défaut) et renvoie la nouvelle ligne.
function cocherEpisodeSerie(idTitre, saison, episode, date) {
  return pbCreer("visionnages", {
    titre: idTitre, date: `${date || dateDuJour()} 00:00:00.000Z`, saison, episode,
  });
}

// ---------- Option « cocher aussi tous les épisodes précédents » ----------
// Pratique pour dire « j'en suis à l'épisode 7 de la saison 3 » : en cochant celui-là,
// tout ce qui vient avant (épisodes d'avant et saisons précédentes) est coché aussi.
// Les épisodes spéciaux (saison 0) et ceux pas encore diffusés ne sont jamais cochés ainsi.
// Le choix est mémorisé dans ce navigateur.
const CLE_OPTION_PRECEDENTS = "cocherPrecedents";
function lireOptionPrecedents() {
  try { return localStorage.getItem(CLE_OPTION_PRECEDENTS) === "1"; } catch (erreur) { return false; }
}
let optionPrecedents = lireOptionPrecedents(); // état actuel de la case

// Épisodes diffusés (hors spéciaux) qui précèdent l'épisode donné : [{saison, episode}, ...]
function episodesAvant(saisons, saison, episode) {
  const resultat = [];
  for (const s of saisons) {
    if (s.numero === 0 || s.numero > saison) continue;
    for (const e of s.episodes) {
      if (estDiffuse(e) && (s.numero < saison || e.numero < episode)) resultat.push({ saison: s.numero, episode: e.numero });
    }
  }
  return resultat;
}

// La case à cocher (à placer dans une barre d'outils)
function creerOptionPrecedents() {
  const caseOption = el("input", { type: "checkbox", checked: optionPrecedents });
  caseOption.addEventListener("change", () => {
    optionPrecedents = caseOption.checked;
    try { localStorage.setItem(CLE_OPTION_PRECEDENTS, optionPrecedents ? "1" : "0"); } catch (erreur) { /* pas grave */ }
  });
  return el("label", { class: "option-precedents" }, caseOption, "Cocher aussi tous les épisodes précédents");
}
