// Page Ma bibliothèque : grille d'affiches de mes titres, avec filtres et tris.
// Les filtres sont gardés dans l'adresse de la page (?type=film&tri=titre...) :
// le bouton « Retour » du navigateur retrouve donc la même vue.
// Filtres avancés (comme dans le catalogue) : genres et pays inclus (vert) / exclus (rouge), années.
// (Dépend de commun.js)

let lignes = [];  // un objet par titre, avec tout ce qu'il faut pour filtrer et trier
const formulaireFiltres = document.getElementById("filtres");
const message = document.getElementById("message");
const grille = document.getElementById("grille");

// ---------- Filtres avancés : genres, pays / régions, années ----------
// Adresse : gi / ge = genres inclus / exclus · pi / pe = pays ou régions inclus / exclus · amin / amax = années
const demandes = new URLSearchParams(location.search);
const listeUrl = (cle) => (demandes.get(cle) || "").split(",").filter((x) => x);
const avances = { genres: {}, pays: {}, anneeMin: (demandes.get("amin") || "").replace(/\D/g, "").slice(0, 4), anneeMax: (demandes.get("amax") || "").replace(/\D/g, "").slice(0, 4) };
listeUrl("gi").forEach((cle) => { avances.genres[cle] = 1; });
listeUrl("ge").forEach((cle) => { avances.genres[cle] = -1; });
listeUrl("pi").forEach((cle) => { avances.pays[cle] = 1; });
listeUrl("pe").forEach((cle) => { avances.pays[cle] = -1; });
let choixPays = { pays: [], regions: [] }; // venus du serveur (avec les codes de pays de chacun)

// TMDB nomme certains genres de séries « Action & Adventure », « Sci-Fi & Fantasy »... : on les sépare
// pour retrouver les mêmes genres que pour les films.
const SYNONYMES_GENRES = { adventure: "Aventure", "sci-fi": "Science-fiction", fantasy: "Fantastique", war: "Guerre", politics: "Politique", kids: "Enfants", family: "Famille" };
const cleGenre = (nom) => nom.toLowerCase().replace(/\s+/g, "-");
function genresDe(ligne) {
  const noms = [];
  (ligne.genres || []).forEach((nom) => nom.split(" & ").forEach((morceau) => noms.push(SYNONYMES_GENRES[morceau.toLowerCase()] || morceau)));
  return noms;
}
const cles = (etat, valeur) => Object.keys(etat).filter((cle) => etat[cle] === valeur);
const nombreAvances = () => Object.keys(avances.genres).length + Object.keys(avances.pays).length + (avances.anneeMin || avances.anneeMax ? 1 : 0);

// ---------- Chargement ----------
async function charger() {
  message.textContent = "Chargement…";
  try {
    const [titres, visionnages] = await Promise.all([pbListe("titres"), pbListe("visionnages")]);
    // On n'attend pas les affiches plus de 1,2 s ; si elles arrivent après, on complète la grille
    const resumes = await chargerResumes(1200, (tard) => { lignes = construireLignes(titres, visionnages, tard); afficher(); });
    lignes = construireLignes(titres, visionnages, resumes);
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
    return;
  }
  message.className = "discret";
  afficher();
  completerAffiches();
}

// Rassemble pour chaque titre : visionnages, ma note, note TMDB, affiche.
function construireLignes(titres, visionnages, resumes) {
  const parTitre = new Map();
  for (const v of visionnages) {
    if (!parTitre.has(v.titre)) parTitre.set(v.titre, []);
    parTitre.get(v.titre).push(v);
  }
  return titres.map((t) => {
    const siens = parTitre.get(t.id) || [];
    const dates = siens.map((v) => String(v.date).slice(0, 10)).filter((d) => d > "").sort();
    // Ma note : série = note de la série ; film = note du visionnage noté le plus récent
    let maNote = 0;
    if (t.type === "film" || (t.source === "tmdb" && t.format_source === "film")) {
      const notes = siens.filter((v) => v.note > 0).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      maNote = notes.length ? notes[0].note : 0;
    } else {
      maNote = t.note_serie || 0;
    }
    const resume = t.source === "tmdb" ? resumes[`${t.format_source}:${t.id_source}`] : null;
    return {
      titre: t,
      vu: t.vu_avant || siens.length > 0,
      dernierVisionnage: dates.length ? dates[dates.length - 1] : "",
      maNote,
      noteTmdb: resume ? resume.note_source || 0 : 0,
      affiche: resume ? resume.affiche : null,
      genres: resume ? resume.genres : undefined, // undefined = pas encore connus (complétés ensuite)
      pays: resume ? resume.pays : undefined,
    };
  });
}

// Les titres TMDB dont l'affiche n'est pas encore en cache : on la demande un par un
// (le serveur la mémorise), puis on redessine la grille.
async function completerAffiches() {
  const manquants = lignes.filter((l) => l.titre.source === "tmdb" && (!l.affiche || l.pays === undefined || l.genres === undefined) && !l.essaye && !(l.titre.image_perso && l.pays));
  let besoinRedessiner = false;
  for (const ligne of manquants) {
    ligne.essaye = true;
    try {
      const d = await source(`details/${ligne.titre.format_source}/${ligne.titre.id_source}`);
      ligne.affiche = d.affiche;
      ligne.noteTmdb = d.note_source || 0;
      ligne.genres = d.genres || [];
      ligne.pays = d.pays || [];
      besoinRedessiner = true;
    } catch (erreur) { /* pas d'internet ou titre disparu : on garde sans affiche */ }
    if (besoinRedessiner && manquants.indexOf(ligne) % 5 === 4) { afficher(); besoinRedessiner = false; }
  }
  if (besoinRedessiner) afficher();
}

// ---------- Filtres et tris ----------
function lireFiltres() {
  const donnees = new FormData(formulaireFiltres);
  return Object.fromEntries(donnees.entries());
}

function correspond(ligne, f) {
  const t = ligne.titre;
  if (f.type && t.type !== f.type) return false;
  if (f.statut && t.statut !== f.statut) return false;
  if (f.vu === "vu" && !ligne.vu) return false;
  if (f.vu === "pas_vu" && ligne.vu) return false;
  if (f.selection === "coeur" && !t.coup_de_coeur) return false;

  // Genres : tous ceux inclus doivent être présents, aucun de ceux exclus
  const siens = genresDe(ligne).map(cleGenre);
  if (cles(avances.genres, 1).some((cle) => !siens.includes(cle))) return false;
  if (cles(avances.genres, -1).some((cle) => siens.includes(cle))) return false;

  // Pays : au moins un des pays inclus ; aucun des pays exclus (un titre au pays inconnu n'est jamais « inclus »)
  const codes = (ligne.pays || []).slice();
  const codesDeChoix = (liste) => liste.flatMap((cle) => (choixPays.pays.concat(choixPays.regions).find((x) => x.cle === cle) || { codes: [] }).codes);
  const inclus = codesDeChoix(cles(avances.pays, 1));
  const exclus = codesDeChoix(cles(avances.pays, -1));
  if (cles(avances.pays, 1).length && !codes.some((c) => inclus.includes(c))) return false;
  if (exclus.length && codes.some((c) => exclus.includes(c))) return false;

  // Années de sortie
  if (avances.anneeMin && !(t.annee >= Number(avances.anneeMin))) return false;
  if (avances.anneeMax && !(t.annee > 0 && t.annee <= Number(avances.anneeMax))) return false;
  return true;
}

// Valeur utilisée pour le tri. "" ou 0 = pas de valeur : ces titres passent toujours en dernier.
function valeurTri(ligne, tri) {
  const t = ligne.titre;
  switch (tri) {
    case "visionnage": return ligne.dernierVisionnage;
    case "ma_note": return ligne.maNote;
    case "note_tmdb": return ligne.noteTmdb;
    case "titre": return t.titre.toLowerCase();
    case "annee": return t.annee;
    default: return t.ajoute_le;
  }
}

function trier(liste, f) {
  const sens = f.ordre === "asc" ? 1 : -1;
  const vide = (v) => v === "" || v === 0 || v === null || v === undefined;
  return [...liste].sort((a, b) => {
    const va = valeurTri(a, f.tri);
    const vb = valeurTri(b, f.tri);
    if (vide(va) !== vide(vb)) return vide(va) ? 1 : -1; // sans valeur : à la fin
    if (va !== vb && !vide(va)) return (va < vb ? -1 : 1) * sens;
    return a.titre.titre.localeCompare(b.titre.titre, "fr"); // égalité : ordre alphabétique
  });
}

// ---------- Affichage ----------
function adresseImage(ligne) {
  return urlImageTitre(ligne.titre, ligne.affiche, "w185");
}

function creerCarte(ligne) {
  const t = ligne.titre;
  const adresse = adresseImage(ligne);
  const affiche = adresse
    ? el("img", { class: "affiche", src: adresse, alt: `Affiche de ${t.titre}`, loading: "lazy" })
    : el("div", { class: "affiche" }, t.titre);
  const infos = [LIBELLES_TYPE[t.type], t.annee || null].filter(Boolean).join(" · ");
  const lien = el("a", { class: "carte-titre carte-lien", href: `fiche.html?id=${t.id}` }, affiche,
    el("div", { class: "carte-corps" },
      el("h2", {}, t.titre),
      el("p", { class: "discret" }, infos),
      el("p", { class: "carte-pied" },
        el("span", { class: `statut statut-${t.statut}` }, LIBELLES_STATUT[t.statut]),
        ligne.maNote ? el("span", { class: "ma-note" }, icone("star"), String(ligne.maNote)) : null)));
  // Le cœur est à côté du lien (pas dedans) : on peut le cliquer sans ouvrir la fiche
  return el("div", { class: "carte-conteneur" }, lien, creerBoutonCoeur(() => t, afficher));
}

function afficher() {
  const f = lireFiltres();
  const visibles = trier(lignes.filter((l) => correspond(l, f)), f);
  document.getElementById("compteur").textContent =
    visibles.length === lignes.length ? `${lignes.length} titre(s)` : `${visibles.length} sur ${lignes.length} titre(s)`;

  grille.replaceChildren(...visibles.map(creerCarte));
  majPanneauAvance();
  if (!lignes.length) {
    message.replaceChildren("Ta bibliothèque est vide. Va dans le ", el("a", { href: "catalogue.html" }, "Catalogue"), " pour ajouter des titres.");
  } else {
    message.textContent = visibles.length ? "" : "Aucun titre ne correspond à ces filtres.";
  }
  // On garde les filtres dans l'adresse (sans recharger la page)
  const adresse = new URLSearchParams(Object.entries(f).filter(([, valeur]) => valeur));
  [["gi", cles(avances.genres, 1)], ["ge", cles(avances.genres, -1)], ["pi", cles(avances.pays, 1)], ["pe", cles(avances.pays, -1)]]
    .forEach(([nom, liste]) => { if (liste.length) adresse.set(nom, liste.join(",")); });
  if (avances.anneeMin) adresse.set("amin", avances.anneeMin);
  if (avances.anneeMax) adresse.set("amax", avances.anneeMax);
  history.replaceState(null, "", adresse.toString() ? `?${adresse}` : location.pathname);
}

// ---------- Panneau « Plus de filtres » ----------
const panneauAvance = el("details", { class: "panneau-filtres" });
const compteurAvance = el("span", { class: "compteur-filtres" });
const zoneGenres = el("div", { class: "puces" });
const zonePays = el("div", { class: "puces" });
const zoneRegions = el("div", { class: "puces" });
let genresAffiches = null; // pour ne redessiner les puces de genres que si la liste change

function champAnnee(nom, cle, repere) {
  const champ = el("input", { type: "number", inputmode: "numeric", min: "1900", max: "2100", placeholder: repere, value: avances[cle] || null, "aria-label": nom });
  champ.addEventListener("input", () => { avances[cle] = champ.value.slice(0, 4); afficher(); });
  return champ;
}

function majPanneauAvance() {
  const n = nombreAvances();
  compteurAvance.textContent = n ? String(n) : "";
  compteurAvance.hidden = !n;
  // Les genres proposés sont ceux de MES titres (plus les genres déjà choisis, pour pouvoir les retirer)
  const connus = new Map();
  lignes.forEach((l) => genresDe(l).forEach((nom) => connus.set(cleGenre(nom), nom)));
  Object.keys(avances.genres).forEach((cle) => { if (!connus.has(cle)) connus.set(cle, cle); });
  const signature = [...connus.keys()].sort().join("|");
  if (signature === genresAffiches) return;
  genresAffiches = signature;
  const tries = [...connus.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  zoneGenres.replaceChildren(...(tries.length ? tries.map(([cle, nom]) => creerPuce(nom, avances.genres, cle, afficher))
    : [el("span", { class: "discret" }, "Les genres apparaissent dès que les fiches de tes titres sont chargées.")]));
}

function construirePanneauAvance() {
  panneauAvance.append(
    el("summary", {}, "Plus de filtres (genres, pays, années)", compteurAvance),
    el("div", { class: "filtres-corps" },
      el("p", { class: "discret" }, "Clique une fois sur une puce pour l'inclure (elle devient verte), deux fois pour l'exclure (rouge), trois fois pour la retirer."),
      el("div", { class: "champ" }, el("label", {}, "Genres (le titre doit avoir tous les genres inclus)"), zoneGenres),
      el("div", { class: "champ" }, el("label", {}, "Régions (au moins une des régions incluses)"), zoneRegions),
      el("div", { class: "champ" }, el("label", {}, "Pays de production"), zonePays),
      el("div", { class: "champ" }, el("label", {}, "Années de sortie"),
        el("div", { class: "champ-annees" }, champAnnee("Année minimum", "anneeMin", "de"), el("span", { class: "discret" }, "à"), champAnnee("Année maximum", "anneeMax", "à"))),
      el("div", { class: "boutons-filtres" },
        el("button", { type: "button", onclick: () => { avances.genres = {}; avances.pays = {}; avances.anneeMin = ""; avances.anneeMax = ""; location.href = "bibliotheque.html"; } }, "Réinitialiser tous les filtres"))));
  if (nombreAvances()) panneauAvance.open = true;
  formulaireFiltres.after(panneauAvance);
  // Pays et régions : même liste que le catalogue (avec leurs codes de pays)
  source("filtres").then((choix) => {
    choixPays = { pays: choix.pays, regions: choix.regions };
    zoneRegions.replaceChildren(...choix.regions.map((x) => creerPuce(x.libelle, avances.pays, x.cle, afficher)));
    zonePays.replaceChildren(...choix.pays.map((x) => creerPuce(x.libelle, avances.pays, x.cle, afficher)));
    if (lignes.length) afficher();
  }).catch(() => { /* sans cette liste, les filtres de pays sont simplement absents */ });
}

// Au chargement : on remet les filtres présents dans l'adresse
for (const champ of formulaireFiltres.elements) {
  if (champ.name && demandes.has(champ.name)) champ.value = demandes.get(champ.name);
}
formulaireFiltres.addEventListener("change", afficher);
construirePanneauAvance();
charger();
