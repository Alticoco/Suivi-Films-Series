// Page Catalogue :
//  - sans recherche : on se balade dans des listes TMDB (tendances, populaires...),
//    avec un défilement infini (la suite se charge quand on arrive en bas) ;
//  - avec une recherche (barre en haut) : mêmes affiches, pour les résultats ;
//  - un clic sur une affiche ouvre une fiche détaillée avec les boutons d'ajout.
// (Dépend de commun.js et formulaires.js)

// ---------- Catégories pour se balader ----------
const CATEGORIES = [
  ["tendances", "Tendances"],
  ["films_a_l_affiche", "Films à l'affiche"],
  ["films_populaires", "Films populaires"],
  ["series_populaires", "Séries populaires"],
  ["films_mieux_notes", "Films les mieux notés"],
  ["series_mieux_notees", "Séries les mieux notées"],
];

const STATUTS_DIFFUSION = {
  "Returning Series": "en cours de diffusion", "Ended": "terminée", "Canceled": "annulée",
  "In Production": "en production", "Planned": "prévue", "Pilot": "pilote",
};

// Mes titres TMDB déjà présents : clé "format:id" → enregistrement
let bibliotheque = new Map();
const cleTitre = (format, idSource) => `${format}:${idSource}`;

async function chargerBibliotheque() {
  const titres = await pbListe("titres", "source = 'tmdb'");
  bibliotheque = new Map(titres.map((t) => [cleTitre(t.format_source, t.id_source), t]));
}

// ---------- Ajout d'un titre TMDB à ma bibliothèque ----------
// mode : "a_voir" ou "vu". "donnees" = FormData du formulaire (type, date, note...).
async function ajouterTitreTmdb(resultat, mode, donnees) {
  const estFilmTmdb = resultat.format === "film";
  const vuAvant = mode === "vu" && (!estFilmTmdb || donnees.get("vu_avant") === "on");
  const titre = await pbCreer("titres", {
    source: "tmdb",
    id_source: resultat.id_source,
    format_source: resultat.format,
    type: donnees.get("type"),
    titre: resultat.titre,
    annee: resultat.annee || 0,
    statut: mode === "vu" ? "termine" : "a_voir",
    vu_avant: vuAvant,
  });
  if (mode === "vu" && estFilmTmdb && !vuAvant) {
    try {
      await pbCreer("visionnages", visionnageDepuisFormulaire(titre.id, donnees));
    } catch (erreur) {
      await pbSupprimer("titres", titre.id); // pas de titre « terminé » sans visionnage
      throw erreur;
    }
  }
  bibliotheque.set(cleTitre(resultat.format, resultat.id_source), titre);
  source(`details/${resultat.format}/${resultat.id_source}`).catch(() => {}); // prépare le cache
  toast(`« ${resultat.titre} » ajouté à ta bibliothèque.`);
  return titre;
}

// ---------- Fenêtre de détail d'un titre ----------
function ouvrirDetail(resultat, apresAjout) {
  const estFilmTmdb = resultat.format === "film";
  const cle = cleTitre(resultat.format, resultat.id_source);

  // Infos déjà connues par la liste : on les affiche tout de suite, puis on complète
  const meta = el("p", { class: "discret" }, [LIBELLES_TYPE[estFilmTmdb ? "film" : "serie"], resultat.annee].filter(Boolean).join(" · "));
  const note = el("p", { class: "note-tmdb" });
  const genres = el("p", { class: "discret" });
  const synopsis = el("p", { class: "synopsis" }, resultat.synopsis || "Chargement du synopsis…");
  const afficheZone = el("div", { class: "detail-affiche" });
  const dessinerAffiche = (chemin) => {
    const adresse = urlAffiche(chemin, "w342");
    afficheZone.replaceChildren(adresse
      ? el("img", { class: "affiche", src: adresse, alt: `Affiche de ${resultat.titre}` })
      : el("div", { class: "affiche" }, "Pas d'affiche"));
  };
  dessinerAffiche(resultat.affiche);
  const noteTexte = (valeur, votes) => (valeur ? `★ ${valeur.toFixed(1)} / 10 sur TMDB${votes ? ` (${votes} votes)` : ""}` : "Pas encore de note TMDB");
  note.textContent = noteTexte(resultat.note_source, 0);

  const actions = el("div", { class: "detail-actions" });
  const dessinerActions = () => {
    actions.replaceChildren();
    const dejaLa = bibliotheque.get(cle);
    if (dejaLa) {
      actions.append(
        el("p", { class: "badge-bibliotheque" }, `✓ Dans ma bibliothèque · ${LIBELLES_STATUT[dejaLa.statut]}`),
        el("a", { href: `fiche.html?id=${dejaLa.id}`, class: "bouton-lien" }, "Ouvrir ma fiche"));
      return;
    }
    // Un animé peut être un film ou une série : le choix dépend du format TMDB.
    const types = [[estFilmTmdb ? "film" : "serie", estFilmTmdb ? "Film" : "Série"], ["anime", "Animé"]];
    const formulaire = el("form", { class: "detail-formulaire" });
    const message = el("p", { class: "erreur-dialogue", hidden: true });
    const boutonAVoir = el("button", { type: "button" }, "＋ Ajouter à voir");
    const boutonVu = el("button", { type: "button", class: "principal" }, "✓ Marquer comme vu");
    formulaire.append(
      champsRadio("type", types, resultat.anime_probable ? "anime" : types[0][0], "Type de titre"),
      el("div", { class: "detail-bloc" }, el("h3", {}, "Pas encore vu ?"), boutonAVoir),
      el("div", { class: "detail-bloc" },
        el("h3", {}, "Je l'ai vu"),
        estFilmTmdb
          ? champsVu()
          : el("p", { class: "discret" }, "Une série marquée « vue » est enregistrée comme « vue avant » (sans date). Tu pourras cocher des épisodes précis depuis sa fiche."),
        boutonVu),
      message);
    const soumettre = (mode) => async () => {
      boutonAVoir.disabled = boutonVu.disabled = true;
      message.hidden = true;
      try {
        await ajouterTitreTmdb(resultat, mode, new FormData(formulaire));
        apresAjout();
        dessinerActions();
      } catch (erreur) {
        message.textContent = erreur.message;
        message.hidden = false;
        boutonAVoir.disabled = boutonVu.disabled = false;
      }
    };
    boutonAVoir.addEventListener("click", soumettre("a_voir"));
    boutonVu.addEventListener("click", soumettre("vu"));
    actions.append(formulaire);
  };
  dessinerActions();

  const fermer = el("button", { type: "button", class: "fermer", "aria-label": "Fermer" }, "✕");
  const fenetre = el("dialog", { class: "dialogue-detail" },
    fermer,
    el("div", { class: "detail" }, afficheZone,
      el("div", { class: "detail-infos" }, el("h2", {}, resultat.titre), meta, note, genres, synopsis, actions)));
  fermer.addEventListener("click", () => fenetre.close());
  fenetre.addEventListener("click", (evenement) => {
    // Un clic sur le fond sombre (en dehors du cadre) ferme la fenêtre. On vérifie que le clic vise
    // bien la fenêtre elle-même : un bouton activé au clavier n'a pas de position et ne doit rien fermer.
    if (evenement.target !== fenetre) return;
    const cadre = fenetre.getBoundingClientRect();
    const dehors = evenement.clientX < cadre.left || evenement.clientX > cadre.right
      || evenement.clientY < cadre.top || evenement.clientY > cadre.bottom;
    if (dehors) fenetre.close();
  });
  fenetre.addEventListener("close", () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();

  // Détails complets (durée, date de sortie en France, genres, vrai synopsis...)
  source(`details/${resultat.format}/${resultat.id_source}`).then((d) => {
    const morceaux = [LIBELLES_TYPE[estFilmTmdb ? "film" : "serie"], d.annee];
    if (d.date_sortie) morceaux.push(`sortie le ${formatDate(d.date_sortie)}`);
    if (d.duree_min) morceaux.push(estFilmTmdb ? formatDuree(d.duree_min) : `${formatDuree(d.duree_min)} par épisode`);
    if (!estFilmTmdb) {
      const saisons = d.saisons.filter((s) => s.numero > 0).length;
      if (saisons) morceaux.push(`${saisons} saison${saisons > 1 ? "s" : ""}`);
      if (d.statut_diffusion && STATUTS_DIFFUSION[d.statut_diffusion]) morceaux.push(STATUTS_DIFFUSION[d.statut_diffusion]);
    }
    meta.textContent = morceaux.filter(Boolean).join(" · ");
    note.textContent = noteTexte(d.note_source, d.nb_votes);
    genres.textContent = d.genres.join(", ");
    synopsis.textContent = d.synopsis || "Pas de synopsis disponible.";
    if (d.affiche && d.affiche !== resultat.affiche) dessinerAffiche(d.affiche);
  }).catch(() => {
    if (!resultat.synopsis) synopsis.textContent = "Pas de synopsis disponible.";
  });
}

// ---------- Ajout manuel ----------
function ouvrirAjoutManuel() {
  const zoneVu = el("div", { hidden: true });
  const champDuree = el("input", { type: "number", name: "duree_min", min: "1", placeholder: "facultative" });
  const etiquetteDuree = el("label", {}, "Durée (minutes)");

  ouvrirDialogue({
    titre: "Ajouter un titre manuellement",
    libelleValider: "Ajouter",
    remplir: (formulaire) => {
      const vuFilm = champsVu();
      const infoSerie = el("p", { class: "discret", hidden: true },
        "Une série ou un animé ajouté comme « Vu » est marqué « vu avant » (sans date).");
      zoneVu.append(vuFilm, infoSerie);

      // Affiche les bons champs selon le type et le statut choisis
      const majFormulaire = () => {
        const type = formulaire.elements.type.value;
        const vu = formulaire.elements.statut.value === "vu";
        etiquetteDuree.textContent = type === "film" ? "Durée du film (minutes)" : "Durée d'un épisode (minutes)";
        zoneVu.hidden = !vu;
        vuFilm.hidden = type !== "film";
        infoSerie.hidden = type === "film";
      };
      formulaire.addEventListener("change", majFormulaire);

      formulaire.append(
        el("div", { class: "champ" }, el("label", {}, "Titre *"), el("input", { type: "text", name: "titre", required: true })),
        champsRadio("type", [["film", "Film"], ["serie", "Série"], ["anime", "Animé (suivi par épisodes)"]], "film", "Type"),
        el("div", { class: "champ" }, el("label", {}, "Année de sortie"), el("input", { type: "number", name: "annee", min: "1850", max: "2100" })),
        el("div", { class: "champ" }, etiquetteDuree, champDuree),
        el("div", { class: "champ" }, el("label", {}, "Image (facultative)"), el("input", { type: "file", name: "image_perso", accept: "image/jpeg,image/png,image/webp" })),
        champsRadio("statut", [["a_voir", "À voir"], ["vu", "Vu"]], "a_voir", "Statut"),
        zoneVu);
      majFormulaire();
    },
    valider: async (donnees) => {
      const type = donnees.get("type");
      const vu = donnees.get("statut") === "vu";
      const vuAvant = vu && (type !== "film" || donnees.get("vu_avant") === "on");

      const envoi = new FormData();
      envoi.set("source", "manuel");
      envoi.set("type", type);
      envoi.set("titre", (donnees.get("titre") || "").trim());
      envoi.set("annee", donnees.get("annee") || "0");
      envoi.set("duree_min", donnees.get("duree_min") || "0");
      envoi.set("statut", vu ? "termine" : "a_voir");
      envoi.set("vu_avant", vuAvant ? "true" : "false");
      const image = donnees.get("image_perso");
      if (image && image.size) envoi.set("image_perso", image);

      const titre = await pbCreer("titres", envoi);
      if (vu && type === "film" && !vuAvant) {
        try {
          await pbCreer("visionnages", visionnageDepuisFormulaire(titre.id, donnees));
        } catch (erreur) {
          await pbSupprimer("titres", titre.id);
          throw erreur;
        }
      }
      toast(`« ${titre.titre} » ajouté à ta bibliothèque.`);
    },
  });
}

// ---------- Grille d'affiches ----------
const grille = document.getElementById("resultats");
const message = document.getElementById("message");
const cartes = new Map(); // clé du titre → son élément dans la grille (pour mettre à jour la pastille)

function majPastille(resultat) {
  const carte = cartes.get(cleTitre(resultat.format, resultat.id_source));
  if (!carte || carte.querySelector(".pastille")) return;
  const dejaLa = bibliotheque.get(cleTitre(resultat.format, resultat.id_source));
  if (dejaLa) carte.querySelector(".carte-affiche-image").append(el("span", { class: "pastille", title: LIBELLES_STATUT[dejaLa.statut] }, "✓"));
}

function creerCarte(resultat) {
  const adresse = urlAffiche(resultat.affiche, "w342");
  const image = adresse
    ? el("img", { class: "affiche", src: adresse, alt: "", loading: "lazy" })
    : el("div", { class: "affiche" }, "Pas d'affiche");
  const sousTitre = [resultat.format === "film" ? "Film" : "Série", resultat.annee].filter(Boolean).join(" · ");
  const carte = el("button", {
    type: "button", class: "carte-affiche",
    "aria-label": `${resultat.titre}, ${sousTitre}. Voir les détails`,
    onclick: () => ouvrirDetail(resultat, () => majPastille(resultat)),
  },
    el("span", { class: "carte-affiche-image" }, image),
    el("span", { class: "carte-affiche-titre" }, resultat.titre),
    el("span", { class: "discret" }, sousTitre));
  cartes.set(cleTitre(resultat.format, resultat.id_source), carte);
  majPastille(resultat);
  return carte;
}

// ---------- Défilement infini ----------
const parametres = new URLSearchParams(location.search);
const texteRecherche = (parametres.get("q") || "").trim();
const categorieChoisie = CATEGORIES.some(([cle]) => cle === parametres.get("categorie")) ? parametres.get("categorie") : "tendances";

const etat = { page: 0, totalPages: 1, enCours: false, dejaVus: new Set(), erreur: false };
const sentinelle = document.getElementById("sentinelle");

async function chargerPageSuivante() {
  if (etat.enCours || etat.page >= etat.totalPages) return;
  etat.enCours = true;
  etat.erreur = false;
  const page = etat.page + 1;
  try {
    const url = texteRecherche
      ? `rechercher?q=${encodeURIComponent(texteRecherche)}&page=${page}`
      : `decouvrir?categorie=${categorieChoisie}&page=${page}`;
    const [liste] = await Promise.all([source(url), page === 1 ? chargerBibliotheque() : null]);
    etat.page = liste.page;
    etat.totalPages = liste.total_pages;
    const nouveaux = liste.resultats.filter((r) => {
      const cle = cleTitre(r.format, r.id_source);
      if (etat.dejaVus.has(cle)) return false; // une même affiche peut revenir d'une page à l'autre
      etat.dejaVus.add(cle);
      return true;
    });
    grille.append(...nouveaux.map(creerCarte));

    if (texteRecherche && !etat.dejaVus.size) {
      message.textContent = `Aucun résultat pour « ${texteRecherche} ». Tu peux l'ajouter manuellement.`;
    } else if (etat.page >= etat.totalPages) {
      message.textContent = "Tu as tout vu : fin de la liste.";
    } else {
      message.textContent = "";
    }
  } catch (erreur) {
    etat.erreur = true;
    message.className = "ko";
    message.replaceChildren(erreur.message, " ",
      el("button", { type: "button", onclick: () => { message.className = "discret"; message.textContent = ""; etat.erreur = false; chargerPageSuivante(); } }, "Réessayer"));
  }
  etat.enCours = false;
  // Si la fin de la grille est toujours visible (grand écran), on enchaîne sur la page suivante
  observateur.disconnect();
  if (!etat.erreur && etat.page < etat.totalPages) observateur.observe(sentinelle);
}

const observateur = new IntersectionObserver((entrees) => {
  if (entrees.some((e) => e.isIntersecting)) chargerPageSuivante();
}, { rootMargin: "900px" });

// ---------- Démarrage ----------
function afficherCategories() {
  const zone = document.getElementById("categories");
  if (texteRecherche) {
    zone.replaceChildren(
      el("span", { class: "discret" }, `Résultats pour « ${texteRecherche} » `),
      el("a", { href: "catalogue.html" }, "← Revenir à la découverte"));
    return;
  }
  zone.replaceChildren(...CATEGORIES.map(([cle, libelle]) =>
    el("a", { href: `catalogue.html?categorie=${cle}`, class: `pastille-categorie${cle === categorieChoisie ? " active" : ""}`, "aria-current": cle === categorieChoisie ? "true" : null }, libelle)));
}

document.getElementById("bouton-manuel").addEventListener("click", ouvrirAjoutManuel);
afficherCategories();
message.textContent = "Chargement…";
chargerPageSuivante();
