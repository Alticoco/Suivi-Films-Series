// Calcul des statistiques (temps passé, titres vus, visionnages par année).
// Utilise MES données (titres, visionnages) et, pour les durées, le cache TMDB.
//
// Règles :
//  - un film compte sa durée à chaque visionnage ;
//  - un épisode compte sa durée propre, sinon la durée habituelle d'un épisode de la série ;
//  - un titre « vu avant » (sans date) compte comme « vu », mais pas dans le temps passé
//    ni dans les années (on ne sait pas quand).
// Les titres dont la durée est inconnue (pas encore en cache) sont listés dans "manquants" :
// la page les demande à la source, puis redemande les statistiques.

function calculer() {
  const titres = $app.findAllRecords("titres");
  const visionnages = $app.findAllRecords("visionnages");

  const parTitre = {};
  visionnages.forEach((v) => {
    const id = v.getString("titre");
    if (!parTitre[id]) parTitre[id] = [];
    parTitre[id].push(v);
  });

  // Lecture du cache avec mémoire (une même fiche n'est lue qu'une fois)
  const memoire = {};
  function enCache(idSource, typeDonnee) {
    const cle = `${idSource}|${typeDonnee}`;
    if (cle in memoire) return memoire[cle];
    let donnees = null;
    try {
      const fiche = $app.findFirstRecordByFilter(
        "cache_source", "source = 'tmdb' && id_source = {:i} && type_donnee = {:t}", { i: idSource, t: typeDonnee });
      donnees = JSON.parse(fiche.getString("donnees"));
    } catch (e) { /* pas en cache */ }
    memoire[cle] = donnees;
    return donnees;
  }

  const anneeEnCours = String(new Date().getFullYear());
  const vus = { film: 0, serie: 0, anime: 0 };
  const parAnnee = {};
  const manquants = {};
  let minutesFilms = 0;
  let minutesEpisodes = 0;
  let titresVusCetteAnnee = 0;

  function annee(a) {
    if (!parAnnee[a]) parAnnee[a] = { annee: Number(a), films: 0, episodes: 0, minutes: 0 };
    return parAnnee[a];
  }

  titres.forEach((t) => {
    const siens = parTitre[t.id] || [];
    if (t.getBool("vu_avant") || siens.length > 0) vus[t.getString("type")]++;
    if (siens.some((v) => v.getString("date").slice(0, 4) === anneeEnCours)) titresVusCetteAnnee++;
    if (!siens.length) return;

    const tmdb = t.getString("source") === "tmdb";
    const idSource = t.getString("id_source");
    const film = tmdb ? t.getString("format_source") === "film" : t.getString("type") === "film";

    // Durée d'un film, ou durée habituelle d'un épisode
    let duree = 0;
    if (tmdb) {
      const fiche = enCache(idSource, film ? "details_film" : "details_serie");
      if (fiche) duree = fiche.duree_min || 0;
      else manquants[`${film ? "film" : "serie"}:${idSource}`] = { format: film ? "film" : "serie", id_source: idSource };
    } else {
      duree = t.getInt("duree_min");
    }

    siens.forEach((v) => {
      const a = annee(v.getString("date").slice(0, 4));
      let minutes = duree;
      if (film) {
        a.films++;
        minutesFilms += minutes;
      } else {
        // Durée propre à l'épisode si on la connaît
        const saison = tmdb ? enCache(idSource, `saison_${v.getInt("saison")}`) : null;
        const episode = saison && saison.find((e) => e.numero === v.getInt("episode"));
        if (episode && episode.duree_min) minutes = episode.duree_min;
        a.episodes++;
        minutesEpisodes += minutes;
      }
      a.minutes += minutes;
    });
  });

  const annees = Object.keys(parAnnee).map((k) => parAnnee[k]).sort((x, y) => x.annee - y.annee);
  return {
    minutes_total: minutesFilms + minutesEpisodes,
    minutes_films: minutesFilms,
    minutes_episodes: minutesEpisodes,
    titres_vus: vus,
    titres_vus_cette_annee: titresVusCetteAnnee,
    annee_en_cours: Number(anneeEnCours),
    par_annee: annees,
    manquants: Object.keys(manquants).map((k) => manquants[k]),
  };
}

module.exports = { calculer };
