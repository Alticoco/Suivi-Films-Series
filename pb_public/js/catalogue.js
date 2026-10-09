// Page Catalogue : recherche dans TMDB, ajout à ma bibliothèque, ajout manuel.
// (Dépend de commun.js et formulaires.js : el, source, pbListe, pbCreer, ouvrirDialogue...)

// Mes titres TMDB déjà présents : clé "format:id" → enregistrement
let bibliotheque = new Map();
const cleTitre = (format, idSource) => `${format}:${idSource}`;

async function chargerBibliotheque() {
  const titres = await pbListe("titres", "source = 'tmdb'");
  bibliotheque = new Map(titres.map((t) => [cleTitre(t.format_source, t.id_source), t]));
}

// ---------- Ajout d'un résultat TMDB ----------
// mode : "a_voir" ou "vu"
function ouvrirAjoutTmdb(resultat, mode, apresAjout) {
  const estFilm = resultat.format === "film";
  // Un animé peut être un film ou une série : le choix dépend du format TMDB.
  const types = [[estFilm ? "film" : "serie", estFilm ? "Film" : "Série"], ["anime", "Animé"]];
  const typeParDefaut = resultat.anime_probable ? "anime" : types[0][0];

  ouvrirDialogue({
    titre: `${mode === "vu" ? "Marquer comme vu" : "Ajouter à voir"} : ${resultat.titre}`,
    libelleValider: mode === "vu" ? "Valider" : "Ajouter",
    remplir: (formulaire) => {
      formulaire.append(champsRadio("type", types, typeParDefaut, "Type de titre"));
      if (mode === "vu" && estFilm) formulaire.append(champsVu());
      if (mode === "vu" && !estFilm) {
        formulaire.append(el("p", { class: "discret" },
          "Une série ajoutée comme « Vu » est marquée « vue avant » (sans date). " +
          "Tu pourras ensuite cocher des épisodes précis depuis sa fiche."));
      }
    },
    valider: async (donnees) => {
      const vuAvant = mode === "vu" && (!estFilm || donnees.get("vu_avant") === "on");
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
      if (mode === "vu" && estFilm && !vuAvant) {
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
      apresAjout();
    },
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

// ---------- Affichage des résultats ----------
function afficherActions(zone, resultat) {
  zone.replaceChildren();
  const dejaLa = bibliotheque.get(cleTitre(resultat.format, resultat.id_source));
  if (dejaLa) {
    zone.append(
      el("span", { class: "badge-bibliotheque" }, `✓ Dans ma bibliothèque · ${LIBELLES_STATUT[dejaLa.statut]}`),
      el("a", { href: `fiche.html?id=${dejaLa.id}`, class: "lien-fiche" }, "Voir la fiche"));
    return;
  }
  const rafraichir = () => afficherActions(zone, resultat);
  zone.append(
    el("button", { type: "button", onclick: () => ouvrirAjoutTmdb(resultat, "a_voir", rafraichir) }, "Ajouter à voir"),
    el("button", { type: "button", onclick: () => ouvrirAjoutTmdb(resultat, "vu", rafraichir) }, "Vu"));
}

function creerCarte(resultat) {
  const adresse = urlAffiche(resultat.affiche, "w185");
  const affiche = adresse
    ? el("img", { class: "affiche", src: adresse, alt: `Affiche de ${resultat.titre}`, loading: "lazy" })
    : el("div", { class: "affiche" }, "Pas d'affiche");
  const actions = el("div", { class: "actions" });
  afficherActions(actions, resultat);
  const sousTitre = [resultat.format === "film" ? "Film" : "Série", resultat.annee].filter(Boolean).join(" · ");
  return el("article", { class: "carte-titre" }, affiche,
    el("div", { class: "carte-corps" }, el("h2", {}, resultat.titre), el("p", { class: "discret" }, sousTitre), actions));
}

async function lancerRecherche(texte) {
  const message = document.getElementById("message");
  const zone = document.getElementById("resultats");
  zone.replaceChildren();
  message.className = "discret";
  message.textContent = "Recherche en cours…";
  try {
    const [resultats] = await Promise.all([
      source(`rechercher?q=${encodeURIComponent(texte)}`),
      chargerBibliotheque(),
    ]);
    message.textContent = resultats.length
      ? `${resultats.length} résultat(s) pour « ${texte} »`
      : `Aucun résultat pour « ${texte} ». Tu peux l'ajouter manuellement.`;
    zone.append(...resultats.map(creerCarte));
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

document.getElementById("bouton-manuel").addEventListener("click", ouvrirAjoutManuel);
const texteRecherche = (new URLSearchParams(location.search).get("q") || "").trim();
if (texteRecherche) lancerRecherche(texteRecherche);
