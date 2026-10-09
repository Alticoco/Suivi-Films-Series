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
function avecCache(idSource, typeDonnee, chercher) {
  const enCache = chercherEnCache(idSource, typeDonnee);
  if (enCache) {
    const age = Date.now() / 1000 - enCache.getDateTime("recupere_le").unix();
    if (age < JOURS_AVANT_RAFRAICHISSEMENT * JOUR_EN_SECONDES) {
      return JSON.parse(enCache.getString("donnees"));
    }
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

// Une recherche n'est pas mise en cache : c'est du direct.
function rechercher(texte) {
  return fournisseur.rechercher(texte);
}

// format : "film" ou "serie"
function details(format, idSource) {
  return avecCache(idSource, `details_${format}`, () => fournisseur.details(format, idSource));
}

function saisons(idSource) {
  const fiche = details("serie", idSource);
  return fiche ? fiche.saisons : null;
}

function episodes(idSource, saison) {
  return avecCache(idSource, `saison_${saison}`, () => fournisseur.episodes(idSource, saison));
}

// Supprime tout ce qui a plus de 6 mois. Renvoie le nombre de lignes supprimées.
function nettoyerCache() {
  const limite = formatDate(new Date(Date.now() - JOURS_AVANT_SUPPRESSION * JOUR_EN_SECONDES * 1000));
  const anciennes = $app.findRecordsByFilter("cache_source", "recupere_le < {:l}", "", 0, 0, { l: limite });
  anciennes.forEach((fiche) => $app.delete(fiche));
  return anciennes.length;
}

module.exports = { rechercher, details, saisons, episodes, nettoyerCache };
