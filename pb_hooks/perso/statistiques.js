// Calcul des statistiques (temps passé, titres vus, visionnages par année).
// Utilise MES données (titres, visionnages) et, pour les durées, le cache TMDB.
//
// Règles :
//  - un film compte sa durée à chaque visionnage ;
//  - un épisode compte sa durée propre, sinon la durée habituelle d'un épisode de la série ;
//  - un titre « vu avant » (sans date) compte comme « vu », mais pas dans le temps passé
//    ni dans les années (on ne sait pas quand).
// Deux jeux de chiffres : « cette_annee » (visionnages datés de l'année en cours) et « total » (toute ma vie :
// toutes les années + ce qui a été vu avant la création du site, sans date). Pour le total, un titre « vu avant »
// compte sa durée : un film une fois, une série tous ses épisodes diffusés (hors spéciaux) non cochés un par un.
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

  // Un jeu de chiffres : cette année, ou toute ma vie
  const nouveauBloc = () => ({ minutes_films: 0, minutes_episodes: 0, minutes_total: 0, films: 0, episodes: 0, revus: 0, titres_vus: { film: 0, serie: 0, anime: 0 } });
  const cetteAnnee = nouveauBloc();
  const total = nouveauBloc();
  function compter(bloc, film, minutes) {
    if (film) { bloc.films++; bloc.minutes_films += minutes; } else { bloc.episodes++; bloc.minutes_episodes += minutes; }
    bloc.minutes_total += minutes;
  }

  function annee(a) {
    if (!parAnnee[a]) parAnnee[a] = { annee: Number(a), films: 0, episodes: 0, minutes: 0 };
    return parAnnee[a];
  }

  titres.forEach((t) => {
    const siens = parTitre[t.id] || [];
    const type = t.getString("type");
    const vuAvant = t.getBool("vu_avant");
    if (vuAvant || siens.length > 0) { vus[type]++; total.titres_vus[type]++; }
    if (siens.some((v) => v.getString("date").slice(0, 4) === anneeEnCours && !v.getBool("avant"))) { titresVusCetteAnnee++; cetteAnnee.titres_vus[type]++; }
    if (!siens.length && !vuAvant) return;

    const tmdb = t.getString("source") === "tmdb";
    const idSource = t.getString("id_source");
    const film = tmdb ? t.getString("format_source") === "film" : type === "film";

    // Durée d'un film, ou durée habituelle d'un épisode
    let duree = 0;
    let fiche = null;
    if (tmdb) {
      fiche = enCache(idSource, film ? "details_film" : "details_serie");
      if (fiche) duree = fiche.duree_min || 0;
      else manquants[`${film ? "film" : "serie"}:${idSource}`] = { format: film ? "film" : "serie", id_source: idSource };
    } else {
      duree = t.getInt("duree_min");
    }

    // Titres revus : un film vu plusieurs fois, une série revue (passage 2 ou plus)
    const dates = siens.filter((v) => !v.getBool("avant")).map((v) => v.getString("date").slice(0, 10)).sort();
    if (film) {
      const dejaVuSansDate = vuAvant || siens.some((v) => v.getBool("avant"));
      if (siens.length + (vuAvant ? 1 : 0) >= 2) total.revus++;
      // Cette année : une vision datée de l'année qui n'est pas la toute première fois
      if (dates.some((d, i) => d.slice(0, 4) === anneeEnCours && (dejaVuSansDate || i > 0))) cetteAnnee.revus++;
    } else {
      if (siens.some((v) => v.getInt("passage") > 1)) total.revus++;
      if (siens.some((v) => v.getInt("passage") > 1 && !v.getBool("avant") && v.getString("date").slice(0, 4) === anneeEnCours)) cetteAnnee.revus++;
    }

    const episodesVus = {}; // « saison:épisode » déjà comptés (pour ne pas les recompter avec « vu avant »)
    siens.forEach((v) => {
      const avant = v.getBool("avant");
      let minutes = duree;
      if (!film) {
        // Durée propre à l'épisode si on la connaît
        const saison = tmdb ? enCache(idSource, `saison_${v.getInt("saison")}`) : null;
        const episode = saison && saison.find((e) => e.numero === v.getInt("episode"));
        if (episode && episode.duree_min) minutes = episode.duree_min;
        if (v.getInt("saison") > 0) episodesVus[`${v.getInt("saison")}:${v.getInt("episode")}`] = true;
      }
      compter(total, film, minutes); // toute ma vie : daté ou non
      if (avant) return; // « vu avant » : pas de date, donc ni année, ni « cette année »
      const a = annee(v.getString("date").slice(0, 4));
      if (film) { a.films++; minutesFilms += minutes; } else { a.episodes++; minutesEpisodes += minutes; }
      a.minutes += minutes;
      if (v.getString("date").slice(0, 4) === anneeEnCours) compter(cetteAnnee, film, minutes);
    });

    // Titre entier « vu avant » : un film compte une fois ; une série compte les épisodes diffusés non cochés un par un
    if (vuAvant) {
      if (film) compter(total, true, duree);
      else if (fiche) {
        const diffuses = (fiche.saisons || []).filter((s) => s.numero > 0).reduce((somme, s) => somme + (s.nb_episodes || 0), 0);
        const restants = Math.max(0, diffuses - Object.keys(episodesVus).length);
        for (let i = 0; i < restants; i++) compter(total, false, duree);
      }
    }
  });

  const annees = Object.keys(parAnnee).map((k) => parAnnee[k]).sort((x, y) => x.annee - y.annee);
  return {
    minutes_total: minutesFilms + minutesEpisodes,
    minutes_films: minutesFilms,
    minutes_episodes: minutesEpisodes,
    titres_vus: vus,
    titres_vus_cette_annee: titresVusCetteAnnee,
    annee_en_cours: Number(anneeEnCours),
    cette_annee: cetteAnnee,
    total: total,
    par_annee: annees,
    manquants: Object.keys(manquants).map((k) => manquants[k]),
  };
}

module.exports = { calculer };
