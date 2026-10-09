// Module TMDB : SEUL endroit qui parle à TMDB (cahier des charges, section 4).
// Il renvoie des objets "neutres" (en français, sans vocabulaire TMDB), pour qu'on
// puisse un jour le remplacer par TVmaze, AniList... sans toucher au reste.
//
// Ce fichier fait uniquement les appels réseau. Le cache est géré par index.js.
//
// Formats neutres : "film" ou "serie" (TMDB : movie / tv).

const URL_API = "https://api.themoviedb.org/3";

// --- Utilitaires ---------------------------------------------------------

function lireJeton() {
  let jeton = "";
  try {
    jeton = toString($os.readFile(`${__hooks}/../secrets/tmdb_token.txt`)).trim();
  } catch (e) {
    throw new Error("Jeton TMDB introuvable (fichier secrets/tmdb_token.txt)");
  }
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jeton)) {
    throw new Error(
      "Le fichier secrets/tmdb_token.txt ne contient pas un jeton valide " +
      "(il doit contenir uniquement le « jeton d'accès en lecture à l'API » de TMDB, qui commence par eyJ)"
    );
  }
  return jeton;
}

// Appel GET vers TMDB. "params" = objet {nom: valeur}.
function appeler(chemin, params) {
  const morceaux = [];
  for (const cle in params) {
    if (params[cle] !== undefined && params[cle] !== null && params[cle] !== "") {
      morceaux.push(`${cle}=${encodeURIComponent(params[cle])}`);
    }
  }
  const reponse = $http.send({
    url: `${URL_API}${chemin}?${morceaux.join("&")}`,
    method: "GET",
    headers: { Authorization: `Bearer ${lireJeton()}`, accept: "application/json" },
    timeout: 20,
  });
  if (reponse.statusCode === 404) return null;
  if (reponse.statusCode === 401) throw new Error("TMDB refuse le jeton (vérifie secrets/tmdb_token.txt)");
  if (reponse.statusCode !== 200) throw new Error(`TMDB a répondu avec l'erreur ${reponse.statusCode}`);
  return reponse.json;
}

function annee(date) {
  return date && date.length >= 4 ? parseInt(date.slice(0, 4), 10) : null;
}

function endpoint(format) {
  if (format === "film") return "movie";
  if (format === "serie") return "tv";
  throw new Error(`Format inconnu : ${format}`);
}

// Un titre est "probablement un animé" s'il est de genre Animation (id 16) et d'origine japonaise.
function animeProbable(donnees) {
  const genres = (donnees.genres || []).map((g) => g.id);
  const idsGenres = genres.length ? genres : donnees.genre_ids || [];
  const japonais =
    (donnees.origin_country || []).indexOf("JP") !== -1 || donnees.original_language === "ja";
  return idsGenres.indexOf(16) !== -1 && japonais;
}

// Affiche : française en priorité, puis sans texte, puis anglaise.
function choisirAffiche(images, parDefaut) {
  const affiches = (images && images.posters) || [];
  for (const langue of ["fr", null, "en"]) {
    const trouvee = affiches.find((a) => a.iso_639_1 === langue);
    if (trouvee) return trouvee.file_path;
  }
  return parDefaut || null;
}

// Date de sortie en France pour un film (la plus ancienne), sinon la date générale.
function dateSortieFrance(donnees) {
  const pays = ((donnees.release_dates || {}).results || []).find((r) => r.iso_3166_1 === "FR");
  if (pays && pays.release_dates.length) {
    const dates = pays.release_dates.map((d) => (d.release_date || "").slice(0, 10)).filter((d) => d);
    dates.sort();
    if (dates.length) return dates[0];
  }
  return donnees.release_date || null;
}

// --- Fonctions neutres exposées -----------------------------------------

// rechercher(texte) → liste de résultats (films + séries)
function rechercher(texte) {
  const donnees = appeler("/search/multi", {
    query: texte, language: "fr-FR", include_adult: "false",
  });
  return (donnees.results || [])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => {
      const film = r.media_type === "movie";
      const date = film ? r.release_date : r.first_air_date;
      return {
        source: "tmdb",
        id_source: String(r.id),
        format: film ? "film" : "serie",
        titre: (film ? r.title : r.name) || "",
        annee: annee(date),
        synopsis: r.overview || "",
        affiche: r.poster_path || null,
        note_source: r.vote_average || null,
        anime_probable: animeProbable(r),
      };
    });
}

// details(format, idSource) → infos d'un titre (null s'il n'existe pas)
function details(format, idSource) {
  const chemin = `/${endpoint(format)}/${idSource}`;
  const films = format === "film";
  const d = appeler(chemin, {
    language: "fr-FR",
    append_to_response: films ? "release_dates,images" : "images",
    include_image_language: "fr,null,en",
  });
  if (!d) return null;

  // Synopsis français, avec repli sur l'anglais s'il est vide
  let synopsis = d.overview || "";
  if (!synopsis) {
    const en = appeler(chemin, { language: "en-US" });
    synopsis = (en && en.overview) || "";
  }

  const dateSortie = films ? dateSortieFrance(d) : d.first_air_date || null;
  let duree = null;
  if (films) duree = d.runtime || null;
  else if (d.episode_run_time && d.episode_run_time.length) duree = d.episode_run_time[0];
  else if (d.last_episode_to_air && d.last_episode_to_air.runtime) duree = d.last_episode_to_air.runtime;

  return {
    source: "tmdb",
    id_source: String(d.id),
    format: format,
    titre: (films ? d.title : d.name) || "",
    titre_original: (films ? d.original_title : d.original_name) || "",
    annee: annee(dateSortie),
    date_sortie: dateSortie,
    synopsis: synopsis,
    duree_min: duree,
    note_source: d.vote_average || null,
    nb_votes: d.vote_count || 0,
    affiche: choisirAffiche(d.images, d.poster_path),
    genres: (d.genres || []).map((g) => g.name),
    anime_probable: animeProbable(d),
    // Spécifique aux séries (vide pour un film)
    statut_diffusion: films ? null : d.status || null,
    saisons: films ? [] : (d.seasons || []).map((s) => ({
      numero: s.season_number,
      nom: s.name || "",
      nb_episodes: s.episode_count || 0,
      date_diffusion: s.air_date || null,
    })),
  };
}

// saisons(idSource) → structure d'une série (liste des saisons)
function saisons(idSource) {
  const d = details("serie", idSource);
  return d ? d.saisons : null;
}

// episodes(idSource, saison) → liste des épisodes d'une saison
function episodes(idSource, saison) {
  const chemin = `/tv/${idSource}/season/${saison}`;
  const d = appeler(chemin, { language: "fr-FR" });
  if (!d) return null;

  let liste = d.episodes || [];
  // Résumés français manquants : repli sur l'anglais
  if (liste.some((e) => !e.overview)) {
    const en = appeler(chemin, { language: "en-US" });
    const anglais = {};
    ((en && en.episodes) || []).forEach((e) => { anglais[e.episode_number] = e.overview; });
    liste = liste.map((e) => Object.assign({}, e, { overview: e.overview || anglais[e.episode_number] || "" }));
  }
  return liste.map((e) => ({
    numero: e.episode_number,
    nom: e.name || "",
    synopsis: e.overview || "",
    date_diffusion: e.air_date || null,
    duree_min: e.runtime || null,
  }));
}

module.exports = { rechercher, details, saisons, episodes };
