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

function pbLire(collection, id) {
  return requete(`/api/collections/${collection}/records/${id}`);
}

// Modifie un enregistrement. "donnees" = objet simple, ou FormData (pour envoyer un fichier).
function pbModifier(collection, id, donnees) {
  const estFormulaire = donnees instanceof FormData;
  return requete(`/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    headers: estFormulaire ? {} : { "Content-Type": "application/json" },
    body: estFormulaire ? donnees : JSON.stringify(donnees),
  });
}

function pbSupprimer(collection, id) {
  return requete(`/api/collections/${collection}/records/${id}`, { method: "DELETE" });
}

// ---------- Libellés ----------
const LIBELLES_TYPE = { film: "Film", serie: "Série", anime: "Animé" };
const LIBELLES_STATUT = {
  a_voir: "À voir", en_cours: "En cours", termine: "Terminé", en_pause: "En pause", abandonne: "Abandonné",
};

// ---------- Images et dates ----------
// Les affiches sont chargées directement chez TMDB (jamais stockées chez moi).
function urlAffiche(chemin, taille) {
  return chemin ? `https://image.tmdb.org/t/p/${taille || "w185"}${chemin}` : null;
}

// Image d'un de mes titres : la mienne si j'en ai mis une, sinon l'affiche TMDB (ou null).
function urlImageTitre(titre, affiche, taille) {
  if (titre.image_perso) return `/api/files/titres/${titre.id}/${encodeURIComponent(titre.image_perso)}`;
  return urlAffiche(affiche, taille);
}

// Un film (TMDB), ou un titre manuel de type film. Un animé « film » compte aussi.
function estFilm(titre) {
  return titre.source === "tmdb" ? titre.format_source === "film" : titre.type === "film";
}

// Date du jour au format AAAA-MM-JJ (heure locale)
function dateDuJour() {
  const d = new Date();
  const deuxChiffres = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

// "2026-10-09 00:00:00.000Z" (ou "2026-10-09") → "09/10/2026"
function formatDate(date) {
  const [annee, mois, jour] = String(date).slice(0, 10).split("-");
  return `${jour}/${mois}/${annee}`;
}

// 136 → "2 h 16 min"
function formatDuree(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
}

// Temps écoulé entre deux dates (AAAA-MM-JJ), en français : "2 ans et 3 mois", "12 jours"...
function dureeEntre(debut, fin) {
  const [a1, m1, j1] = debut.slice(0, 10).split("-").map(Number);
  const [a2, m2, j2] = fin.slice(0, 10).split("-").map(Number);
  let annees = a2 - a1;
  let mois = m2 - m1;
  let jours = j2 - j1;
  if (jours < 0) {
    mois--;
    jours += new Date(Date.UTC(a2, m2 - 1, 0)).getUTCDate(); // nombre de jours du mois précédent
  }
  if (mois < 0) {
    annees--;
    mois += 12;
  }
  const morceaux = [];
  if (annees) morceaux.push(`${annees} an${annees > 1 ? "s" : ""}`);
  if (mois) morceaux.push(`${mois} mois`);
  if (!annees && jours) morceaux.push(`${jours} jour${jours > 1 ? "s" : ""}`);
  return morceaux.length ? morceaux.join(" et ") : "le même jour";
}

// Statistiques calculées par le serveur. Si des durées manquent (titres pas encore en cache),
// on les fait charger par la source (le serveur les mémorise), puis on redemande les chiffres.
async function chargerStatistiques() {
  let stats = await requete("/api/perso/statistiques");
  if (stats.manquants.length) {
    await Promise.all(stats.manquants.map((m) => source(`details/${m.format}/${m.id_source}`).catch(() => null)));
    stats = await requete("/api/perso/statistiques");
  }
  return stats;
}

// ---------- Traitement en parallèle ----------
// Exécute "travail" sur chaque élément, 4 à la fois, en signalant la progression.
async function enParallele(elements, travail, progression) {
  let suivant = 0;
  let faits = 0;
  const ouvrier = async () => {
    while (suivant < elements.length) {
      const element = elements[suivant++];
      await travail(element);
      progression(++faits, elements.length);
    }
  };
  await Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()]);
}

// ---------- Coup de cœur ----------
// Bouton cœur d'un titre. "lireTitre" renvoie le titre à jour (l'objet peut être remplacé par un plus récent).
// "apres" est appelé une fois le changement enregistré.
function creerBoutonCoeur(lireTitre, apres) {
  const bouton = el("button", { type: "button", class: "coeur" });
  const dessiner = () => {
    const actif = !!lireTitre().coup_de_coeur;
    bouton.classList.toggle("actif", actif);
    bouton.setAttribute("aria-pressed", String(actif));
    bouton.title = actif ? "Retirer des coups de cœur" : "Ajouter aux coups de cœur";
    bouton.setAttribute("aria-label", bouton.title);
    bouton.replaceChildren(icone("heart"));
  };
  bouton.addEventListener("click", async (evenement) => {
    evenement.preventDefault(); // le bouton peut se trouver dans une carte cliquable
    evenement.stopPropagation();
    bouton.disabled = true;
    try {
      const titre = lireTitre();
      const misAJour = await pbModifier("titres", titre.id, { coup_de_coeur: !titre.coup_de_coeur });
      titre.coup_de_coeur = misAJour.coup_de_coeur;
      toast(titre.coup_de_coeur ? `« ${titre.titre} » ajouté à tes coups de cœur.` : `« ${titre.titre} » retiré des coups de cœur.`);
      if (apres) apres();
    } catch (erreur) {
      toast(erreur.message, true);
    }
    bouton.disabled = false;
    dessiner();
  });
  dessiner();
  return bouton;
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
  { nom: "Ma bibliothèque", url: "bibliotheque.html", dispo: true },
  { nom: "Journal", url: "journal.html", dispo: true },
  { nom: "Statistiques", url: "statistiques.html", dispo: true },
  { nom: "Sauvegarde", url: "sauvegarde.html", dispo: true },
];

// Suggestions qui apparaissent pendant qu'on tape dans la barre de recherche : les titres dont le nom
// ressemble à ce qu'on a écrit (ex. « game » → Game of Thrones, The Game...). Un clic sur une suggestion
// ouvre directement la fiche de ce titre dans le catalogue ; « Entrée » lance la recherche complète.
function activerSuggestions(formulaire) {
  const champ = formulaire.querySelector("input");
  const liste = el("ul", { class: "suggestions", role: "listbox", id: "liste-suggestions", hidden: true });
  champ.setAttribute("role", "combobox");
  champ.setAttribute("aria-autocomplete", "list");
  champ.setAttribute("aria-controls", "liste-suggestions");
  champ.setAttribute("aria-expanded", "false");
  champ.setAttribute("autocomplete", "off");
  formulaire.append(liste);

  let minuteur = null;
  let numeroDemande = 0; // pour ignorer une réponse arrivée trop tard
  let indexActif = -1;

  const fermer = () => { liste.hidden = true; champ.setAttribute("aria-expanded", "false"); indexActif = -1; };
  const surligner = (index) => {
    [...liste.children].forEach((li, i) => { li.classList.toggle("active", i === index); li.setAttribute("aria-selected", String(i === index)); });
    indexActif = index;
  };
  const dessiner = (texte, resultats) => {
    const lignes = resultats.map((r) => {
      const adresse = urlAffiche(r.affiche, "w92");
      const li = el("li", { role: "option", class: "suggestion", "aria-selected": "false" },
        adresse ? el("img", { class: "suggestion-affiche", src: adresse, alt: "" }) : el("span", { class: "suggestion-affiche suggestion-vide" }),
        el("span", { class: "suggestion-texte" }, el("strong", {}, r.titre),
          el("span", { class: "discret" }, [r.format === "film" ? "Film" : "Série", r.annee].filter(Boolean).join(" · "))));
      li.addEventListener("mousedown", (e) => { e.preventDefault(); location.href = `catalogue.html?q=${encodeURIComponent(r.titre)}&ouvrir=${r.format}:${r.id_source}`; });
      return li;
    });
    const tous = el("li", { role: "option", class: "suggestion suggestion-tous", "aria-selected": "false" }, icone("search"), `Voir tous les résultats pour « ${texte} »`);
    tous.addEventListener("mousedown", (e) => { e.preventDefault(); location.href = `catalogue.html?q=${encodeURIComponent(texte)}`; });
    liste.replaceChildren(...lignes, tous);
    liste.hidden = false;
    champ.setAttribute("aria-expanded", "true");
    indexActif = -1;
  };

  champ.addEventListener("input", () => {
    clearTimeout(minuteur);
    const texte = champ.value.trim();
    if (texte.length < 2) { fermer(); return; }
    minuteur = setTimeout(async () => {
      const numero = ++numeroDemande;
      try {
        const page = await source(`rechercher?q=${encodeURIComponent(texte)}`);
        if (numero !== numeroDemande || champ.value.trim() !== texte) return; // on a continué à taper entre-temps
        if (page.resultats.length) dessiner(texte, page.resultats.slice(0, 8)); else fermer();
      } catch (erreur) { fermer(); }
    }, 250);
  });
  champ.addEventListener("keydown", (e) => {
    const lignes = [...liste.children];
    if (liste.hidden || !lignes.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); surligner((indexActif + 1) % lignes.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); surligner((indexActif - 1 + lignes.length) % lignes.length); }
    else if (e.key === "Enter" && indexActif >= 0) { e.preventDefault(); lignes[indexActif].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); }
    else if (e.key === "Escape") fermer();
  });
  champ.addEventListener("blur", fermer);
  champ.addEventListener("focus", () => { if (liste.children.length && champ.value.trim().length >= 2) liste.hidden = false; });
}

function construireEntete() {
  const pageCourante = location.pathname.split("/").pop() || "index.html";
  const liens = PAGES.map((page) => {
    if (!page.dispo) return el("span", { class: "nav-bientot", title: "Bientôt disponible" }, page.nom);
    return el("a", { href: page.url, class: page.url === pageCourante ? "nav-actif" : "" }, page.nom);
  });
  const q = new URLSearchParams(location.search).get("q") || "";
  const recherche = el("form", { class: "recherche", action: "catalogue.html", method: "get" },
    el("input", { type: "search", name: "q", value: q, placeholder: "Rechercher un film ou une série…", "aria-label": "Rechercher" }),
    el("button", { type: "submit" }, icone("search"), "Rechercher"));
  activerSuggestions(recherche);
  return el("header", { class: "entete" },
    el("div", { class: "entete-contenu" },
      el("a", { href: "index.html", class: "logo" }, icone("film"), "Suivi Films & Séries"),
      el("nav", {}, liens),
      recherche));
}

function construirePied() {
  return el("footer", { class: "pied" },
    el("img", { class: "logo-tmdb", src: "img/tmdb-logo.svg", alt: "The Movie Database (TMDB)", loading: "lazy" }),
    el("p", { class: "discret" }, "This product uses the TMDB API but is not endorsed or certified by TMDB."));
}

// Icône de l'onglet (la même sur toutes les pages)
document.head.append(el("link", { rel: "icon", type: "image/svg+xml", href: "img/favicon.svg" }));
document.body.prepend(construireEntete());
document.body.append(construirePied());
