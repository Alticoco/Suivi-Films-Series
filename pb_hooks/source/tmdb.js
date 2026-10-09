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

// Transforme un résultat TMDB (recherche ou découverte) en résultat neutre.
// "formatImpose" sert aux listes qui ne contiennent que des films ou que des séries.
function resultatNeutre(r, formatImpose) {
  const type = formatImpose || (r.media_type === "movie" ? "film" : r.media_type === "tv" ? "serie" : null);
  if (!type) return null; // personnes, etc. : on ignore
  const film = type === "film";
  const date = film ? r.release_date : r.first_air_date;
  return {
    source: "tmdb",
    id_source: String(r.id),
    format: type,
    titre: (film ? r.title : r.name) || "",
    annee: annee(date),
    synopsis: r.overview || "",
    affiche: r.poster_path || null,
    note_source: r.vote_average || null,
    anime_probable: animeProbable(r),
  };
}

// Une « page » de résultats : { page, total_pages, resultats }
function pageDeResultats(donnees, formatImpose) {
  return {
    page: donnees.page || 1,
    total_pages: Math.min(donnees.total_pages || 1, 500), // TMDB ne donne rien au-delà de 500
    resultats: (donnees.results || []).map((r) => resultatNeutre(r, formatImpose)).filter((r) => r !== null),
  };
}

// rechercher(texte, page) → résultats (films + séries), page par page
function rechercher(texte, page) {
  return pageDeResultats(appeler("/search/multi", {
    query: texte, language: "fr-FR", include_adult: "false", page: page || 1,
  }));
}

// Catégories proposées pour « se balader » dans le catalogue
const CATEGORIES = {
  tendances: { chemin: "/trending/all/week" },
  films_a_l_affiche: { chemin: "/movie/now_playing", format: "film", region: "FR" },
  films_populaires: { chemin: "/movie/popular", format: "film" },
  series_populaires: { chemin: "/tv/popular", format: "serie" },
  films_mieux_notes: { chemin: "/movie/top_rated", format: "film" },
  series_mieux_notees: { chemin: "/tv/top_rated", format: "serie" },
};

// decouvrir(categorie, page) → une page de titres à parcourir
function decouvrir(categorie, page) {
  const choix = CATEGORIES[categorie];
  if (!choix) throw new Error(`Catégorie inconnue : ${categorie}`);
  return pageDeResultats(appeler(choix.chemin, {
    language: "fr-FR", page: page || 1, region: choix.region,
  }), choix.format);
}

// Version du format de "details" : un titre déjà en cache avec un format plus ancien est rechargé.
// (v2 : distribution, réalisateur, studio, box-office, pays, classification)
const VERSION_DETAILS = 2;

function personne(p) {
  return { nom: p.name || "", photo: p.profile_path || null };
}

// Sans doublon : une même personne peut avoir plusieurs métiers (ex. réalisateur et producteur)
function premiers(liste, nombre) {
  const vus = {};
  const resultat = [];
  for (const p of liste) {
    if (!p.name || vus[p.name]) continue;
    vus[p.name] = true;
    resultat.push(personne(p));
    if (resultat.length >= nombre) break;
  }
  return resultat;
}

// Classification (âge conseillé) : en France si elle existe, sinon aux États-Unis
function classification(d, films) {
  for (const pays of ["FR", "US"]) {
    if (films) {
      const entree = ((d.release_dates || {}).results || []).find((r) => r.iso_3166_1 === pays);
      const dates = (entree && entree.release_dates) || [];
      const avecClassification = dates.find((x) => x.certification);
      if (avecClassification) return { valeur: avecClassification.certification, pays: pays };
    } else {
      const entree = ((d.content_ratings || {}).results || []).find((r) => r.iso_3166_1 === pays);
      if (entree && entree.rating) return { valeur: entree.rating, pays: pays };
    }
  }
  return null;
}

// details(format, idSource) → infos d'un titre (null s'il n'existe pas)
function details(format, idSource) {
  const chemin = `/${endpoint(format)}/${idSource}`;
  const films = format === "film";
  const d = appeler(chemin, {
    language: "fr-FR",
    append_to_response: films ? "release_dates,images,credits" : "images,credits,content_ratings",
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

  const credits = d.credits || {};
  const equipe = credits.crew || [];
  // Studio : les deux premières sociétés de production (films) ou la chaîne / plateforme (séries)
  const noms = (liste) => (liste || []).slice(0, 2).map((x) => x.name).filter((n) => n).join(" · ");

  return {
    version: VERSION_DETAILS,
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
    // Pays de production (codes ISO, ex. "US") et langue d'origine
    pays: films ? (d.production_countries || []).map((p) => p.iso_3166_1) : d.origin_country || [],
    langue_originale: d.original_language || "",
    // Récapitulatif : studio, box-office, classification, équipe et distribution
    studio: films ? noms(d.production_companies) : noms(d.networks) || noms(d.production_companies),
    box_office: films ? d.revenue || 0 : 0,   // en dollars ; 0 = inconnu
    budget: films ? d.budget || 0 : 0,
    classification: classification(d, films),
    realisateurs: films ? premiers(equipe.filter((c) => c.job === "Director"), 3) : [],
    createurs: films ? [] : (d.created_by || []).slice(0, 3).map(personne),
    producteurs: premiers(equipe.filter((c) => c.job === (films ? "Producer" : "Executive Producer")), 3),
    acteurs: (credits.cast || []).slice(0, 6).map((c) => ({ nom: c.name || "", photo: c.profile_path || null, role: c.character || "" })),
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

// ---------- Explorer le catalogue avec des filtres (inclure / exclure) ----------
// Genres : [clé, libellé, identifiant TMDB pour un film, identifiant TMDB pour une série (null = n'existe pas)]
const GENRES = [
  ["action", "Action", 28, 10759], ["aventure", "Aventure", 12, 10759], ["animation", "Animation", 16, 16],
  ["comedie", "Comédie", 35, 35], ["crime", "Crime", 80, 80], ["documentaire", "Documentaire", 99, 99],
  ["drame", "Drame", 18, 18], ["famille", "Famille", 10751, 10751], ["fantastique", "Fantastique", 14, 10765],
  ["histoire", "Histoire", 36, null], ["horreur", "Horreur", 27, null], ["musique", "Musique", 10402, null],
  ["mystere", "Mystère", 9648, 9648], ["romance", "Romance", 10749, null], ["science_fiction", "Science-fiction", 878, 10765],
  ["thriller", "Thriller", 53, null], ["guerre", "Guerre", 10752, 10768], ["western", "Western", 37, 37],
];

const decouper = (texte) => texte.split(" ");

// Tous les pays (codes ISO 3166-1, plus quelques anciens pays que TMDB connaît encore)
const TOUS_LES_PAYS = decouper(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW SU YU CS DD");

// Pays proposés dans les filtres : [clé, libellé, codes]
const PAYS = [
  ["etats_unis", "États-Unis", ["US"]], ["france", "France", ["FR"]], ["royaume_uni", "Royaume-Uni", ["GB"]],
  ["allemagne", "Allemagne", ["DE"]], ["espagne", "Espagne", ["ES"]], ["italie", "Italie", ["IT"]], ["canada", "Canada", ["CA"]],
  ["japon", "Japon", ["JP"]], ["coree_du_sud", "Corée du Sud", ["KR"]],
  ["chine", "Chine, Hong Kong, Taïwan", ["CN", "HK", "TW", "MO"]], ["inde", "Inde", ["IN"]],
];

// Grandes régions : [clé, libellé, codes]
const REGIONS = [
  ["asie", "Asie", decouper("JP KR KP CN HK TW MO MN IN PK BD LK NP BT MV AF TH VN ID MY SG PH KH LA MM BN TL KZ UZ TM TJ KG")],
  ["europe", "Europe", decouper("FR GB DE ES IT PT NL BE LU CH AT IE IS NO SE DK FI EE LV LT PL CZ SK HU RO BG GR HR SI RS BA ME MK AL XK MD UA BY RU MT CY AD MC SM VA LI SU YU CS DD AX FO GI IM JE GG")],
  ["amerique_du_nord", "Amérique du Nord", decouper("US CA GL BM")],
  ["amerique_latine", "Amérique latine", decouper("MX GT BZ HN SV NI CR PA CU DO HT JM PR TT BS BB CO VE EC PE BO BR PY UY AR CL GY SR GF")],
  ["afrique", "Afrique", decouper("DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH RE YT")],
  ["moyen_orient", "Moyen-Orient", decouper("TR IR IQ IL SA AE QA KW BH OM YE JO LB SY PS AM GE AZ")],
  ["oceanie", "Océanie", decouper("AU NZ PG FJ SB VU WS TO KI TV NR PW FM MH NC PF")],
];

// Ce que la page affiche comme choix de filtres (sans rien de propre à TMDB)
function filtresDisponibles() {
  return {
    genres: GENRES.map((g) => ({ cle: g[0], libelle: g[1] })),
    regions: REGIONS.map((r) => ({ cle: r[0], libelle: r[1] })),
    pays: PAYS.map((p) => ({ cle: p[0], libelle: p[1] })),
  };
}

function codesDe(cles) {
  const resultat = {};
  for (const cle of cles) {
    const trouve = PAYS.find((p) => p[0] === cle) || REGIONS.find((r) => r[0] === cle);
    if (trouve) trouve[2].forEach((code) => { resultat[code] = true; });
  }
  return resultat;
}

// Liste des pays à demander à TMDB : (pays choisis, ou tous) moins les pays exclus.
// Renvoie null s'il n'y a aucune contrainte, et [] si plus aucun pays ne convient.
function paysAutorises(inclus, exclus) {
  if (!inclus.length && !exclus.length) return null;
  const base = inclus.length ? Object.keys(codesDe(inclus)) : TOUS_LES_PAYS;
  const interdits = codesDe(exclus);
  return base.filter((code) => !interdits[code]);
}

function liste(valeur) {
  return (valeur || "").split(",").map((x) => x.trim()).filter((x) => x);
}

// Une page de résultats pour un seul format (film ou série), ou null si les filtres sont impossibles
function pageExplorer(format, p) {
  const colonne = format === "film" ? 2 : 3;
  const idsGenres = (cles) => cles.map((cle) => (GENRES.find((g) => g[0] === cle) || [])[colonne]);
  const inclus = idsGenres(liste(p.genres_inclus));
  if (inclus.some((id) => !id)) return null; // ce genre n'existe pas pour ce format (ex. horreur pour une série)
  const exclus = idsGenres(liste(p.genres_exclus)).filter((id) => id);
  const uniques = (ids) => ids.filter((id, i) => ids.indexOf(id) === i);

  const pays = paysAutorises(liste(p.pays_inclus), liste(p.pays_exclus));
  if (pays && !pays.length) return null;

  const film = format === "film";
  const champDate = film ? "primary_release_date" : "first_air_date";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const parametres = {
    language: "fr-FR", include_adult: "false", page: p.page || 1,
    with_genres: uniques(inclus).join(","),          // virgule = « tous ces genres à la fois »
    without_genres: uniques(exclus).join("|"),       // barre = « n'importe lequel de ces genres »
    with_origin_country: pays ? pays.join("|") : "", // barre = « n'importe lequel de ces pays »
  };
  if (p.annee_min) parametres[`${champDate}.gte`] = `${parseInt(p.annee_min, 10)}-01-01`;
  if (p.annee_max) parametres[`${champDate}.lte`] = `${parseInt(p.annee_max, 10)}-12-31`;
  if (p.tri === "mieux_notes") {
    parametres.sort_by = "vote_average.desc";
    parametres["vote_count.gte"] = 300; // sinon un film noté 10 par 3 personnes arrive en tête
  } else if (p.tri === "recents") {
    parametres.sort_by = `${champDate}.desc`;
    if (!p.annee_max) parametres[`${champDate}.lte`] = aujourdhui; // pas de titres pas encore sortis
  } else {
    parametres.sort_by = "popularity.desc";
  }
  return pageDeResultats(appeler(`/discover/${endpoint(format)}`, parametres), format);
}

// explorer(parametres) → une page de titres correspondant aux filtres
// parametres : type (tous|film|serie), genres_inclus / genres_exclus, pays_inclus / pays_exclus
// (clés séparées par des virgules), annee_min, annee_max, tri (populaires|mieux_notes|recents), page
function explorer(p) {
  const formats = p.type === "film" ? ["film"] : p.type === "serie" ? ["serie"] : ["film", "serie"];
  const pages = formats.map((format) => pageExplorer(format, p)).filter((page) => page !== null);
  if (!pages.length) return { page: p.page || 1, total_pages: 1, resultats: [] };
  // Films et séries sont mélangés une affiche sur deux
  const resultats = [];
  const longueur = Math.max.apply(null, pages.map((page) => page.resultats.length));
  for (let i = 0; i < longueur; i++) pages.forEach((page) => { if (page.resultats[i]) resultats.push(page.resultats[i]); });
  return {
    page: pages[0].page,
    total_pages: Math.max.apply(null, pages.map((page) => page.total_pages)),
    resultats: resultats,
  };
}

// ---------- Rechercher par acteur ou réalisateur ----------
// personnes(texte) → les personnes qui portent ce nom (pour choisir la bonne)
function personnes(texte) {
  const d = appeler("/search/person", { query: texte, language: "fr-FR", include_adult: "false", page: 1 });
  return ((d && d.results) || []).slice(0, 8).map((p) => ({
    id: String(p.id),
    nom: p.name || "",
    photo: p.profile_path || null,
    metier: p.known_for_department === "Directing" ? "realisateur" : p.known_for_department === "Acting" ? "acteur" : "autre",
    connu_pour: (p.known_for || []).slice(0, 3).map((k) => k.title || k.name).filter((x) => x),
  }));
}

// Genres de type « émission » (talk-show, info, télé-réalité) : on n'y compte pas une apparition comme un rôle
const GENRES_EMISSIONS = [10767, 10763, 10764];

// filmographie(parametres) → une page de titres d'une personne, avec les mêmes filtres que explorer()
// parametres : personne_id, personne_role (acteur | realisateur), type, genres_inclus / genres_exclus,
// annee_min, annee_max, tri, page.
//  - acteur : rôles principaux (les 5 premiers du casting d'un film ; au moins 5 épisodes pour une série)
//  - réalisateur : titres qu'il a réalisés
function filmographie(p) {
  const id = String(p.personne_id || "");
  if (!/^[0-9]+$/.test(id)) throw new Error("Identifiant de personne invalide");
  const d = appeler(`/person/${id}/combined_credits`, { language: "fr-FR" });
  const acteur = p.personne_role !== "realisateur";
  const brut = !d ? [] : acteur
    ? (d.cast || []).filter((c) => {
      if (/\b(self|himself|herself|soi-m)/i.test(c.character || "")) return false;       // apparition « en tant que soi-même »
      if (c.media_type === "movie") return c.order !== undefined && c.order < 5;
      return (c.episode_count || 0) >= 5 && !(c.genre_ids || []).some((g) => GENRES_EMISSIONS.indexOf(g) !== -1);
    })
    : (d.crew || []).filter((c) => c.job === "Director");

  const vus = {};
  const inclus = liste(p.genres_inclus);
  const exclus = liste(p.genres_exclus);
  const anneeMin = parseInt(p.annee_min, 10) || 0;
  const anneeMax = parseInt(p.annee_max, 10) || 0;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const gardes = brut.filter((c) => {
    if (c.media_type !== "movie" && c.media_type !== "tv") return false;
    const cle = `${c.media_type}:${c.id}`;
    if (vus[cle]) return false;          // un même titre n'apparaît qu'une fois
    vus[cle] = true;
    if (p.type === "film" && c.media_type !== "movie") return false;
    if (p.type === "serie" && c.media_type !== "tv") return false;

    const colonne = c.media_type === "movie" ? 2 : 3;
    const genres = c.genre_ids || [];
    for (const cleGenre of inclus) {
      const gid = (GENRES.find((g) => g[0] === cleGenre) || [])[colonne];
      if (!gid || genres.indexOf(gid) === -1) return false;
    }
    for (const cleGenre of exclus) {
      const gid = (GENRES.find((g) => g[0] === cleGenre) || [])[colonne];
      if (gid && genres.indexOf(gid) !== -1) return false;
    }
    const date = c.media_type === "movie" ? c.release_date : c.first_air_date;
    const an = annee(date) || 0;
    if (anneeMin && an < anneeMin) return false;
    if (anneeMax && an > anneeMax) return false;
    if (p.tri === "recents" && (!date || date > aujourdhui)) return false; // pas de titres pas encore sortis
    return true;
  });

  if (p.tri === "mieux_notes") {
    gardes.sort((a, b) => (b.vote_count >= 100 ? b.vote_average : 0) - (a.vote_count >= 100 ? a.vote_average : 0));
  } else if (p.tri === "recents") {
    gardes.sort((a, b) => ((b.release_date || b.first_air_date || "") > (a.release_date || a.first_air_date || "") ? 1 : -1));
  } else {
    gardes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }

  const parPage = 20;
  const page = Math.max(1, p.page || 1);
  return {
    page: page,
    total_pages: Math.max(1, Math.ceil(gardes.length / parPage)),
    resultats: gardes.slice((page - 1) * parPage, page * parPage)
      .map((c) => resultatNeutre(c, c.media_type === "movie" ? "film" : "serie")),
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

module.exports = { rechercher, decouvrir, explorer, filtresDisponibles, codesDe, personnes, filmographie, details, saisons, episodes };
