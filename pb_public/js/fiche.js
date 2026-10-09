// Page Fiche titre : infos, statut, notes, image, suppression.
// Pour un film : liste de mes visionnages + bouton « Vu ».
// Pour une série : voir fiche-serie.js.
// (Dépend de commun.js, formulaires.js et fiche-serie.js)

const idTitre = new URLSearchParams(location.search).get("id") || "";
const zone = document.getElementById("contenu");

let titre = null;        // enregistrement « titres »
let visionnages = [];    // ses visionnages, du plus récent au plus ancien

// Un film (TMDB), ou un titre manuel de type film. Un animé « film » compte aussi.
function estFilm(t) {
  return t.source === "tmdb" ? t.format_source === "film" : t.type === "film";
}

// Image à afficher : la mienne si j'en ai mis une, sinon l'affiche TMDB (taille moyenne).
function adresseImage(t, affiche) {
  if (t.image_perso) return `/api/files/titres/${t.id}/${encodeURIComponent(t.image_perso)}`;
  return urlAffiche(affiche, "w342");
}

async function charger() {
  if (!/^[a-z0-9]+$/.test(idTitre)) {
    zone.replaceChildren(el("p", { class: "ko" }, "Titre introuvable (identifiant manquant)."));
    return;
  }
  try {
    titre = await pbLire("titres", idTitre);
    visionnages = await pbListe("visionnages", `titre = '${idTitre}'`);
  } catch (erreur) {
    zone.replaceChildren(el("p", { class: "ko" }, `Titre introuvable : ${erreur.message}`));
    return;
  }
  // Du plus récent au plus ancien (à date égale, le dernier créé d'abord)
  visionnages.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created).localeCompare(String(a.created)));
  document.title = `${titre.titre} — Suivi Films & Séries`;
  afficher();
}

// ---------- Mises à jour ----------
async function modifierTitre(changements, message) {
  titre = await pbModifier("titres", titre.id, changements);
  if (message) toast(message);
}

// ---------- Affichage ----------
let enteteImage = null; // élément <img> ou <div> de l'affiche, remplacé quand les infos TMDB arrivent

function afficher() {
  const film = estFilm(titre);
  const sousTitre = [LIBELLES_TYPE[titre.type], titre.annee || null].filter(Boolean).join(" · ");

  // --- Colonne de gauche : image et réglages de l'image ---
  const colonneImage = el("div", { class: "fiche-image" });
  enteteImage = creerImage(adresseImage(titre, null));
  colonneImage.append(enteteImage, boutonsImage());

  // --- Colonne de droite : infos ---
  const infosSource = el("div", { id: "infos-source" }, el("p", { class: "discret" }, titre.source === "tmdb" ? "Chargement des infos TMDB…" : ""));
  const selectStatut = el("select", { id: "statut", "aria-label": "Statut" },
    Object.entries(LIBELLES_STATUT).map(([valeur, libelle]) => el("option", { value: valeur, selected: valeur === titre.statut }, libelle)));
  selectStatut.addEventListener("change", async () => {
    try {
      await modifierTitre({ statut: selectStatut.value }, `Statut : ${LIBELLES_STATUT[selectStatut.value]}`);
    } catch (erreur) {
      toast(erreur.message, true);
      selectStatut.value = titre.statut;
    }
  });

  const champNotes = el("textarea", { id: "notes", rows: "5", placeholder: "Mes notes libres sur ce titre…" }, titre.notes || "");
  const boutonNotes = el("button", { type: "button", onclick: async () => {
    try { await modifierTitre({ notes: champNotes.value }, "Notes enregistrées."); }
    catch (erreur) { toast(erreur.message, true); }
  } }, "Enregistrer mes notes");

  const colonneInfos = el("div", { class: "fiche-infos" },
    el("h1", {}, titre.titre),
    el("p", { class: "discret" }, sousTitre),
    infosSource,
    el("div", { class: "champ fiche-statut" }, el("label", { for: "statut" }, "Statut"), selectStatut),
    film ? el("button", { type: "button", class: "principal", onclick: ouvrirVu }, "✓ Vu") : null,
    el("div", { class: "champ" }, el("label", { for: "notes" }, "Mes notes"), champNotes, boutonNotes));

  const bas = [];
  if (film) bas.push(sectionVisionnages());
  else bas.push(sectionSerie()); // voir fiche-serie.js
  bas.push(zoneDanger());

  zone.replaceChildren(
    el("p", {}, el("a", { href: "catalogue.html" }, "← Catalogue")),
    el("div", { class: "fiche" }, colonneImage, colonneInfos),
    ...bas);

  if (titre.source === "tmdb") chargerInfosSource();
  else afficherInfosManuel();
}

function creerImage(adresse) {
  return adresse
    ? el("img", { class: "affiche", src: adresse, alt: `Image de ${titre.titre}` })
    : el("div", { class: "affiche" }, "Pas d'image");
}

function afficherInfosManuel() {
  const bloc = document.getElementById("infos-source");
  bloc.replaceChildren(el("p", { class: "discret" },
    titre.duree_min ? `Durée : ${formatDuree(titre.duree_min)}${estFilm(titre) ? "" : " par épisode"}` : "Titre ajouté manuellement."));
}

// Infos venant de TMDB (via le serveur, avec cache). Si ça échoue, la fiche reste utilisable.
async function chargerInfosSource() {
  const bloc = document.getElementById("infos-source");
  try {
    const d = await source(`details/${titre.format_source}/${titre.id_source}`);
    const lignes = [];
    if (d.titre_original && d.titre_original !== d.titre) lignes.push(`Titre original : ${d.titre_original}`);
    if (d.date_sortie) lignes.push(`Sortie : ${formatDate(d.date_sortie)}`);
    if (d.duree_min) lignes.push(`Durée : ${formatDuree(d.duree_min)}${estFilm(titre) ? "" : " par épisode"}`);
    if (d.note_source) lignes.push(`Note TMDB : ${d.note_source.toFixed(1)} / 10 (${d.nb_votes} votes)`);
    if (d.genres.length) lignes.push(d.genres.join(", "));
    bloc.replaceChildren(
      el("p", { class: "discret" }, lignes.join(" · ")),
      el("p", { class: "synopsis" }, d.synopsis || "Pas de synopsis disponible."));
    // Image TMDB (sauf si j'ai mis la mienne)
    if (!titre.image_perso && d.affiche) {
      const nouvelle = creerImage(urlAffiche(d.affiche, "w342"));
      enteteImage.replaceWith(nouvelle);
      enteteImage = nouvelle;
    }
  } catch (erreur) {
    bloc.replaceChildren(el("p", { class: "ko" }, `Infos TMDB indisponibles : ${erreur.message}`));
  }
}

// ---------- Image personnelle ----------
function boutonsImage() {
  const fichier = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true });
  fichier.addEventListener("change", async () => {
    if (!fichier.files.length) return;
    const envoi = new FormData();
    envoi.set("image_perso", fichier.files[0]);
    try {
      await modifierTitre(envoi, "Image remplacée.");
      afficher();
    } catch (erreur) {
      toast(erreur.message, true);
    }
  });
  const boutons = [
    fichier,
    el("button", { type: "button", onclick: () => fichier.click() }, "Remplacer l'image"),
  ];
  if (titre.image_perso) {
    boutons.push(el("button", { type: "button", onclick: async () => {
      try {
        await modifierTitre({ image_perso: null }, "Image personnelle retirée.");
        afficher();
      } catch (erreur) {
        toast(erreur.message, true);
      }
    } }, "Retirer mon image"));
  }
  return el("div", { class: "fiche-boutons-image" }, boutons);
}

// ---------- Visionnages (films) ----------
function sectionVisionnages() {
  const section = el("section", { class: "carte" }, el("h2", {}, "Mes visionnages"));

  // Dates triées de la plus ancienne à la plus récente, pour calculer le temps écoulé
  const datesAnciennes = visionnages.map((v) => String(v.date).slice(0, 10)).sort();

  if (!visionnages.length && !titre.vu_avant) {
    section.append(el("p", { class: "discret" }, "Aucun visionnage pour l'instant. Clique sur « Vu » quand tu l'as regardé."));
  }
  if (titre.vu_avant) {
    section.append(el("p", {}, "🕘 Vu avant la création du site (date inconnue)"));
  }

  const liste = el("ul", { class: "liste-visionnages" });
  visionnages.forEach((v) => {
    const date = String(v.date).slice(0, 10);
    const position = datesAnciennes.indexOf(date);
    const precedente = position > 0 ? datesAnciennes[position - 1] : null;
    const details = [];
    if (v.note) details.push(`★ ${v.note}/10`);
    if (precedente) details.push(`revu ${dureeEntre(precedente, date) === "le même jour" ? "le même jour" : "après " + dureeEntre(precedente, date)}`);
    liste.append(el("li", {},
      el("div", {},
        el("strong", {}, formatDate(date)),
        details.length ? el("span", { class: "discret" }, ` · ${details.join(" · ")}`) : null,
        v.commentaire ? el("p", { class: "commentaire" }, v.commentaire) : null),
      el("div", { class: "actions-ligne" },
        el("button", { type: "button", onclick: () => ouvrirModifierVisionnage(v) }, "Modifier"),
        el("button", { type: "button", onclick: () => ouvrirSupprimerVisionnage(v) }, "Supprimer"))));
  });
  if (visionnages.length) section.append(liste);
  return section;
}

// Bouton « Vu » : nouveau visionnage (ou marqueur « vu avant »)
function ouvrirVu() {
  ouvrirDialogue({
    titre: `Marquer comme vu : ${titre.titre}`,
    libelleValider: "Valider",
    remplir: (formulaire) => formulaire.append(champsVu()),
    valider: async (donnees) => {
      if (donnees.get("vu_avant") === "on") {
        await modifierTitre({ vu_avant: true, statut: "termine" });
        toast("Marqué « vu avant ».");
      } else {
        await pbCreer("visionnages", visionnageDepuisFormulaire(titre.id, donnees));
        await modifierTitre({ statut: "termine" }); // film : un visionnage → terminé
        toast("Visionnage ajouté.");
      }
      await charger();
    },
  });
}

function ouvrirModifierVisionnage(v) {
  ouvrirDialogue({
    titre: "Modifier le visionnage",
    libelleValider: "Enregistrer",
    remplir: (formulaire) => formulaire.append(champsVu(
      { date: String(v.date).slice(0, 10), note: v.note, commentaire: v.commentaire }, false)),
    valider: async (donnees) => {
      await pbModifier("visionnages", v.id, visionnageDepuisFormulaire(null, donnees));
      toast("Visionnage modifié.");
      await charger();
    },
  });
}

function ouvrirSupprimerVisionnage(v) {
  ouvrirDialogue({
    titre: "Supprimer ce visionnage ?",
    libelleValider: "Supprimer",
    danger: true,
    remplir: (formulaire) => formulaire.append(el("p", {}, `Le visionnage du ${formatDate(v.date)} sera supprimé.`)),
    valider: async () => {
      await pbSupprimer("visionnages", v.id);
      // Plus aucun visionnage et pas de « vu avant » : le film n'est plus « terminé »
      if (visionnages.length === 1 && !titre.vu_avant && titre.statut === "termine") {
        await modifierTitre({ statut: "a_voir" });
      }
      toast("Visionnage supprimé.");
      await charger();
    },
  });
}

// ---------- Suppression du titre ----------
function zoneDanger() {
  return el("section", { class: "zone-danger" },
    el("button", { type: "button", class: "danger", onclick: ouvrirSupprimerTitre }, "Supprimer ce titre"));
}

function ouvrirSupprimerTitre() {
  ouvrirDialogue({
    titre: "Supprimer ce titre ?",
    libelleValider: "Supprimer définitivement",
    danger: true,
    remplir: (formulaire) => formulaire.append(el("p", {},
      `« ${titre.titre} » et tous ses visionnages seront supprimés de ta bibliothèque. Cette action est définitive.`)),
    valider: async () => {
      await pbSupprimer("titres", titre.id); // les visionnages partent avec (suppression en cascade)
      location.href = "catalogue.html";
    },
  });
}

charger();
