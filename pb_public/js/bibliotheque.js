// Page Ma bibliothèque : grille d'affiches de mes titres, avec filtres et tris.
// Les filtres sont gardés dans l'adresse de la page (?type=film&tri=titre...) :
// le bouton « Retour » du navigateur retrouve donc la même vue.
// (Dépend de commun.js)

let lignes = [];  // un objet par titre, avec tout ce qu'il faut pour filtrer et trier
const formulaireFiltres = document.getElementById("filtres");
const message = document.getElementById("message");
const grille = document.getElementById("grille");

// ---------- Chargement ----------
async function charger() {
  message.textContent = "Chargement…";
  try {
    const [titres, visionnages, resumes] = await Promise.all([
      pbListe("titres"),
      pbListe("visionnages"),
      source("resumes").catch(() => ({})), // sans ça, on affiche juste moins d'affiches
    ]);
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
    };
  });
}

// Les titres TMDB dont l'affiche n'est pas encore en cache : on la demande un par un
// (le serveur la mémorise), puis on redessine la grille.
async function completerAffiches() {
  const manquants = lignes.filter((l) => l.titre.source === "tmdb" && !l.affiche && !l.titre.image_perso && !l.essaye);
  let besoinRedessiner = false;
  for (const ligne of manquants) {
    ligne.essaye = true;
    try {
      const d = await source(`details/${ligne.titre.format_source}/${ligne.titre.id_source}`);
      ligne.affiche = d.affiche;
      ligne.noteTmdb = d.note_source || 0;
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
  return el("a", { class: "carte-titre carte-lien", href: `fiche.html?id=${t.id}` }, affiche,
    el("div", { class: "carte-corps" },
      el("h2", {}, t.titre),
      el("p", { class: "discret" }, infos),
      el("p", { class: "carte-pied" },
        el("span", { class: `statut statut-${t.statut}` }, LIBELLES_STATUT[t.statut]),
        ligne.maNote ? el("span", { class: "ma-note" }, `★ ${ligne.maNote}`) : null)));
}

function afficher() {
  const f = lireFiltres();
  const visibles = trier(lignes.filter((l) => correspond(l, f)), f);
  document.getElementById("compteur").textContent =
    visibles.length === lignes.length ? `${lignes.length} titre(s)` : `${visibles.length} sur ${lignes.length} titre(s)`;

  grille.replaceChildren(...visibles.map(creerCarte));
  if (!lignes.length) {
    message.replaceChildren("Ta bibliothèque est vide. Va dans le ", el("a", { href: "catalogue.html" }, "Catalogue"), " pour ajouter des titres.");
  } else {
    message.textContent = visibles.length ? "" : "Aucun titre ne correspond à ces filtres.";
  }
  // On garde les filtres dans l'adresse (sans recharger la page)
  const adresse = new URLSearchParams(Object.entries(f).filter(([, valeur]) => valeur));
  history.replaceState(null, "", adresse.toString() ? `?${adresse}` : location.pathname);
}

// Au chargement : on remet les filtres présents dans l'adresse
const demandes = new URLSearchParams(location.search);
for (const champ of formulaireFiltres.elements) {
  if (champ.name && demandes.has(champ.name)) champ.value = demandes.get(champ.name);
}
formulaireFiltres.addEventListener("change", afficher);
charger();
