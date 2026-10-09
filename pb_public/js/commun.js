// Briques communes à toutes les pages :
//  - en-tête (navigation + recherche) et pied de page (mention TMDB)
//  - petites fonctions pour construire du HTML et parler au serveur

// ---------- Construire du HTML sans risque ----------
// el("p", {class: "discret"}, "texte", autreElement)
// Les textes sont insérés comme du TEXTE (jamais interprétés comme du HTML).
function el(balise, attributs, ...enfants) {
  const element = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs || {})) {
    if (nom === "class") element.className = valeur;
    else if (nom.startsWith("on")) element.addEventListener(nom.slice(2), valeur);
    else if (valeur === true) element.setAttribute(nom, "");
    else if (valeur !== false && valeur !== null && valeur !== undefined) element.setAttribute(nom, valeur);
  }
  for (const enfant of enfants.flat()) {
    if (enfant !== null && enfant !== undefined && enfant !== false) element.append(enfant);
  }
  return element;
}

// ---------- Parler au serveur ----------
// Transforme une erreur de PocketBase ou de la source en phrase lisible.
function messageErreur(donnees, statut) {
  if (!donnees) return `Erreur du serveur (${statut})`;
  const details = Object.entries(donnees.data || {}).map(([champ, e]) => `${champ} : ${e.message}`);
  return [donnees.message, ...details].filter(Boolean).join(" — ");
}

async function requete(url, options) {
  let reponse;
  try {
    reponse = await fetch(url, options);
  } catch (erreur) {
    throw new Error("Le serveur ne répond pas. Est-il lancé ?");
  }
  let donnees = null;
  try { donnees = await reponse.json(); } catch (erreur) { /* réponse vide (ex. suppression) */ }
  if (!reponse.ok) throw new Error(messageErreur(donnees, reponse.status));
  return donnees;
}

// Appel à la source de données (TMDB) via le serveur : source("rechercher?q=matrix")
function source(chemin) {
  return requete(`/api/source/${chemin}`);
}

// Liste complète d'une collection PocketBase (filtre facultatif).
async function pbListe(collection, filtre) {
  const resultat = [];
  let page = 1;
  while (true) {
    let url = `/api/collections/${collection}/records?perPage=500&page=${page}`;
    if (filtre) url += `&filter=${encodeURIComponent(filtre)}`;
    const reponse = await requete(url);
    resultat.push(...reponse.items);
    if (page >= reponse.totalPages) return resultat;
    page++;
  }
}

// Crée un enregistrement. "donnees" = objet simple, ou FormData (pour envoyer un fichier).
function pbCreer(collection, donnees) {
  const estFormulaire = donnees instanceof FormData;
  return requete(`/api/collections/${collection}/records`, {
    method: "POST",
    headers: estFormulaire ? {} : { "Content-Type": "application/json" },
    body: estFormulaire ? donnees : JSON.stringify(donnees),
  });
}

function pbSupprimer(collection, id) {
  return requete(`/api/collections/${collection}/records/${id}`, { method: "DELETE" });
}

// ---------- Images et dates ----------
// Les affiches sont chargées directement chez TMDB (jamais stockées chez moi).
function urlAffiche(chemin, taille) {
  return chemin ? `https://image.tmdb.org/t/p/${taille || "w185"}${chemin}` : null;
}

// Date du jour au format AAAA-MM-JJ (heure locale)
function dateDuJour() {
  const d = new Date();
  const deuxChiffres = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

// ---------- Messages éphémères ----------
function toast(texte, erreur) {
  const message = el("div", { class: "toast" + (erreur ? " toast-erreur" : "") }, texte);
  document.body.append(message);
  setTimeout(() => message.remove(), erreur ? 6000 : 3500);
}

// ---------- En-tête et pied de page ----------
const PAGES = [
  { nom: "Accueil", url: "index.html", dispo: true },
  { nom: "Catalogue", url: "catalogue.html", dispo: true },
  { nom: "Ma bibliothèque", url: "bibliotheque.html", dispo: false },
  { nom: "Journal", url: "journal.html", dispo: false },
  { nom: "Statistiques", url: "statistiques.html", dispo: false },
  { nom: "Sauvegarde", url: "sauvegarde.html", dispo: false },
];

function construireEntete() {
  const pageCourante = location.pathname.split("/").pop() || "index.html";
  const liens = PAGES.map((page) => {
    if (!page.dispo) return el("span", { class: "nav-bientot", title: "Bientôt disponible" }, page.nom);
    return el("a", { href: page.url, class: page.url === pageCourante ? "nav-actif" : "" }, page.nom);
  });
  const q = new URLSearchParams(location.search).get("q") || "";
  const recherche = el("form", { class: "recherche", action: "catalogue.html", method: "get" },
    el("input", { type: "search", name: "q", value: q, placeholder: "Rechercher un film ou une série…", "aria-label": "Rechercher" }),
    el("button", { type: "submit" }, "Rechercher"));
  return el("header", { class: "entete" },
    el("div", { class: "entete-contenu" },
      el("a", { href: "index.html", class: "logo" }, "🎬 Suivi Films & Séries"),
      el("nav", {}, liens),
      recherche));
}

function construirePied() {
  return el("footer", { class: "pied" },
    el("p", { class: "discret" }, "This product uses the TMDB API but is not endorsed or certified by TMDB."));
}

document.body.prepend(construireEntete());
document.body.append(construirePied());
