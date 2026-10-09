// Interface de la "source" de données, avec cache.
// Le reste du code n'importe QUE ce fichier : il ne sait pas que c'est TMDB.
// Pour changer de source un jour, on change la ligne "fournisseur" ci-dessous.
//
// Règles du cache (cahier des charges, section 9) :
//  - une donnée de plus de 30 jours est rafraîchie ;
//  - si le rafraîchissement échoue (pas d'internet...), on garde l'ancienne ;
//  - la tâche quotidienne supprime tout ce qui a plus de 6 mois.

const fournisseur = require(`${__hooks}/source/tmdb.js`);
const NOM_SOURCE = "tmdb";
const JOURS_AVANT_RAFRAICHISSEMENT = 30;
const JOURS_AVANT_SUPPRESSION = 183; // environ 6 mois

const JOUR_EN_SECONDES = 24 * 3600;

// Date au format de PocketBase ("2026-10-09 12:00:00.000Z")
function formatDate(date) {
  return date.toISOString().replace("T", " ");
}

function chercherEnCache(idSource, typeDonnee) {
  try {
    return $app.findFirstRecordByFilter(
      "cache_source",
      "source = {:s} && id_source = {:i} && type_donnee = {:t}",
      { s: NOM_SOURCE, i: String(idSource), t: typeDonnee }
    );
  } catch (e) {
    return null; // pas encore en cache
  }
}

function ecrireEnCache(enregistrement, idSource, typeDonnee, donnees) {
  const collection = $app.findCollectionByNameOrId("cache_source");
  const fiche = enregistrement || new Record(collection);
  fiche.set("source", NOM_SOURCE);
  fiche.set("id_source", String(idSource));
  fiche.set("type_donnee", typeDonnee);
  fiche.set("donnees", donnees);
  fiche.set("recupere_le", formatDate(new Date()));
  $app.save(fiche);
}

// Renvoie la donnée en cache si elle est récente, sinon la récupère via "chercher()".
// "versionMin" : une donnée enregistrée avec un format plus ancien (version plus petite) est rechargée.
function avecCache(idSource, typeDonnee, chercher, versionMin) {
  const enCache = chercherEnCache(idSource, typeDonnee);
  if (enCache) {
    const age = Date.now() / 1000 - enCache.getDateTime("recupere_le").unix();
    const donnees = JSON.parse(enCache.getString("donnees"));
    const versionOk = !versionMin || (donnees && donnees.version >= versionMin);
    if (age < JOURS_AVANT_RAFRAICHISSEMENT * JOUR_EN_SECONDES && versionOk) return donnees;
  }
  try {
    const frais = chercher();
    if (frais !== null) ecrireEnCache(enCache, idSource, typeDonnee, frais);
    return frais;
  } catch (erreur) {
    if (enCache) return JSON.parse(enCache.getString("donnees")); // ancienne version, mieux que rien
    throw erreur;
  }
}

// --- Fonctions neutres -----------------------------------------------------

// Une recherche (ou une liste de découverte) n'est pas mise en cache : c'est du direct.
// "filtres" (facultatif) : type, genres, pays, années (voir explorer) pour retirer ce qui n'intéresse pas
function rechercher(texte, page, filtres) {
  return remplirLaPage(page || 1, (numero) => filtrerParPays(fournisseur.rechercher(texte, numero, filtres), filtres || {}));
}

function decouvrir(categorie, page) {
  return fournisseur.decouvrir(categorie, page);
}

// Parcourir le catalogue avec des filtres (inclure / exclure des genres, des pays...)
//
// Pour les filtres de pays, la source ne sait pas être stricte (elle laisse passer des coproductions) :
// on vérifie donc les vrais pays de production de chaque titre (fiches gardées en cache, donc de plus
// en plus rapide). « Inclure » = au moins un des pays choisis ; « exclure » = aucun des pays exclus
// (une coproduction avec un pays exclu est donc écartée).
function explorer(parametres) {
  // Avec une personne choisie : sa filmographie (mêmes filtres) ; sinon le catalogue entier
  const charger = (numero) => {
    const p = Object.assign({}, parametres, { page: numero });
    return filtrerParPays(parametres.personne_id ? fournisseur.filmographie(p) : fournisseur.explorer(p), parametres);
  };
  return remplirLaPage(parametres.page || 1, charger);
}

// Quand les filtres écartent beaucoup de titres, une page de la source peut ne rien donner : on regarde
// alors les pages suivantes (jusqu'à 5 au total, 7 secondes au plus) pour avoir de quoi remplir l'écran.
// La page renvoyée est la dernière regardée : la suite reprendra juste après.
function remplirLaPage(premiere, chargerPage) {
  const debut = Date.now();
  let derniere = chargerPage(premiere);
  const resultats = derniere.resultats.slice();
  let numero = derniere.page;
  while (resultats.length < 12 && numero < derniere.total_pages && numero - premiere < 4 && Date.now() - debut < 7000) {
    numero++;
    derniere = chargerPage(numero);
    derniere.resultats.forEach((titre) => {
      if (!resultats.some((x) => x.format === titre.format && x.id_source === titre.id_source)) resultats.push(titre);
    });
  }
  return { page: numero, total_pages: derniere.total_pages, resultats: resultats };
}

// Écarte d'une page de résultats les titres qui ne passent pas les filtres de pays
function filtrerParPays(page, parametres) {
  const liste = (v) => (v || "").split(",").map((x) => x.trim()).filter((x) => x);
  const inclus = liste(parametres.pays_inclus);
  const exclus = liste(parametres.pays_exclus);
  if (!inclus.length && !exclus.length) return page;

  const voulus = fournisseur.codesDe(inclus);
  const interdits = fournisseur.codesDe(exclus);
  page.resultats = page.resultats.filter((titre) => {
    let codes = [];
    try { codes = details(titre.format, titre.id_source).pays || []; } catch (e) { return false; } // impossible de vérifier : on écarte
    titre.pays = codes;
    if (inclus.length && !codes.some((c) => voulus[c])) return false;
    return !codes.some((c) => interdits[c]);
  });
  return page;
}

// Les films d'une saga (gardés en cache comme le reste)
function saga(idCollection) {
  return avecCache(idCollection, "saga", () => fournisseur.saga(idCollection));
}

// Les personnes (acteurs, réalisateurs...) portant ce nom
function personnes(texte, metier) {
  return fournisseur.personnes(texte, metier);
}

// Les choix de filtres proposés par la page (genres, pays, régions)
function filtres() {
  return fournisseur.filtresDisponibles();
}

// Pays de plusieurs titres d'un coup (pour étiqueter les affiches d'une liste).
// "ids" : liste de "film:603" / "serie:1399". Les fiches viennent du cache, sinon de la source ;
// un titre qui échoue est simplement omis. 24 titres au maximum par appel.
function pays(ids) {
  const resultat = {};
  ids.slice(0, 24).forEach((cle) => {
    const morceaux = cle.split(":");
    if ((morceaux[0] !== "film" && morceaux[0] !== "serie") || !/^[0-9]+$/.test(morceaux[1] || "")) return;
    try {
      const fiche = details(morceaux[0], morceaux[1]);
      if (fiche) resultat[cle] = fiche.pays || [];
    } catch (e) { /* on passe au suivant */ }
  });
  return resultat;
}

// format : "film" ou "serie"
function details(format, idSource) {
  return avecCache(idSource, `details_${format}`, () => fournisseur.details(format, idSource), 3);
}

function saisons(idSource) {
  const fiche = details("serie", idSource);
  return fiche ? fiche.saisons : null;
}

function episodes(idSource, saison) {
  return avecCache(idSource, `saison_${saison}`, () => fournisseur.episodes(idSource, saison));
}

// Résumé de tout ce qui est déjà en cache (affiche + note), pour afficher une grille
// sans interroger la source titre par titre. Clé : "format:id" (ex. "serie:1399").
// Les titres absents du cache sont simplement omis : la page les demande ensuite un par un.
function resumes() {
  const resultat = {};
  const fiches = $app.findRecordsByFilter("cache_source", "source = {:s} && type_donnee ~ 'details_'", "", 0, 0, { s: NOM_SOURCE });
  fiches.forEach((fiche) => {
    const donnees = JSON.parse(fiche.getString("donnees"));
    // genres / pays : servent aux filtres de la bibliothèque (pays absent = fiche ancienne, à recharger)
    resultat[`${donnees.format}:${donnees.id_source}`] = { affiche: donnees.affiche, note_source: donnees.note_source, genres: donnees.genres, pays: donnees.pays };
  });
  return resultat;
}

// Nombre de lignes actuellement en cache.
function infoCache() {
  return { lignes: $app.countRecords("cache_source") };
}

// Vide tout le cache (bouton de la page Sauvegarde). Il se reconstruit tout seul ensuite.
// Ne touche JAMAIS à mes données (titres, visionnages).
function viderCache() {
  const lignes = $app.findAllRecords("cache_source");
  lignes.forEach((fiche) => $app.delete(fiche));
  return { supprimees: lignes.length };
}

// Supprime tout ce qui a plus de 6 mois. Renvoie le nombre de lignes supprimées.
function nettoyerCache() {
  const limite = formatDate(new Date(Date.now() - JOURS_AVANT_SUPPRESSION * JOUR_EN_SECONDES * 1000));
  const anciennes = $app.findRecordsByFilter("cache_source", "recupere_le < {:l}", "", 0, 0, { l: limite });
  anciennes.forEach((fiche) => $app.delete(fiche));
  return anciennes.length;
}

module.exports = { rechercher, decouvrir, explorer, personnes, saga, filtres, pays, details, saisons, episodes, resumes, infoCache, viderCache, nettoyerCache };
