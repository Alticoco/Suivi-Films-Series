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
  ["sagas", "Sagas"],
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

// ---------- Série : choisir la saison et les épisodes déjà vus ----------
// Crée la série dans ma bibliothèque avec les épisodes cochés (tous à la même date).
// "apres" est appelé une fois la série ajoutée.
function creerFormulaireSerie(resultat, apres) {
  const formulaire = el("form", { class: "detail-formulaire" });
  const message = el("p", { class: "erreur-dialogue", hidden: true });
  const date = el("input", { type: "date", name: "date", value: dateDuJour() });
  const caseAvant = el("input", { type: "checkbox", name: "episodes_avant" }); // « vu avant, date inconnue »
  caseAvant.addEventListener("change", () => { date.disabled = caseAvant.checked; });
  const selectSaison = el("select", { "aria-label": "Saison", disabled: true });
  const liste = el("ul", { class: "liste-episodes liste-episodes-choix" });
  const compteur = el("span", { class: "discret" });
  const boutonSaison = el("button", { type: "button", class: "contour", disabled: true }, "Cocher la saison");
  const boutonJusqua = el("button", { type: "button", class: "contour", disabled: true }, "Tout cocher jusqu'à cette saison");
  const boutonEnregistrer = el("button", { type: "button", class: "principal", disabled: true }, icone("check"), "Enregistrer les épisodes cochés");
  const boutonAVoir = el("button", { type: "button" }, icone("plus"), "Ajouter à voir");
  const boutonDejaVue = el("button", { type: "button" }, icone("check"), "Je l'ai déjà vue en entier (sans date)");
  const etatChargement = el("p", { class: "discret" }, "Chargement des saisons…");
  const zoneEpisodes = el("div", { hidden: true });

  let saisons = [];
  const choisis = new Set(); // « saison:épisode » cochés
  const saisonCourante = () => saisons.find((s) => String(s.numero) === selectSaison.value);
  const diffuses = (saison) => saison.episodes.filter(estDiffuse);
  const toutCoche = (saison) => diffuses(saison).length > 0 && diffuses(saison).every((e) => choisis.has(cleEpisode(saison.numero, e.numero)));

  function majBoutons() {
    const saison = saisonCourante();
    const n = choisis.size;
    compteur.textContent = `${n} épisode${n > 1 ? "s" : ""} coché${n > 1 ? "s" : ""}`;
    boutonEnregistrer.disabled = n === 0;
    boutonEnregistrer.replaceChildren(icone("check"), n ? `Enregistrer ${n} épisode${n > 1 ? "s" : ""} vu${n > 1 ? "s" : ""}` : "Enregistrer les épisodes cochés");
    if (!saison) return;
    boutonSaison.disabled = diffuses(saison).length === 0;
    boutonSaison.textContent = toutCoche(saison) ? "Décocher la saison" : "Cocher la saison";
    boutonJusqua.disabled = saison.numero === 0 || diffuses(saison).length === 0; // pas pour les épisodes spéciaux
  }

  function dessinerListe() {
    const saison = saisonCourante();
    liste.replaceChildren(...(saison ? saison.episodes : []).map((episode) => {
      const cle = cleEpisode(saison.numero, episode.numero);
      const case_ = el("input", { type: "checkbox", checked: choisis.has(cle), disabled: !estDiffuse(episode) });
      case_.addEventListener("change", () => {
        if (case_.checked) {
          choisis.add(cle);
          // Option : cocher aussi tout ce qui précède (saisons d'avant et épisodes d'avant)
          if (optionPrecedents) {
            episodesAvant(saisons, saison.numero, episode.numero).forEach((x) => choisis.add(cleEpisode(x.saison, x.episode)));
            dessinerListe();
            return;
          }
        } else {
          choisis.delete(cle);
        }
        majBoutons();
      });
      const info = estDiffuse(episode)
        ? (episode.date_diffusion ? formatDate(episode.date_diffusion) : "")
        : (episode.date_diffusion ? `à venir le ${formatDate(episode.date_diffusion)}` : "date inconnue");
      return el("li", {}, el("label", { title: episode.synopsis || "" }, case_, ` ${episode.numero}. ${episode.nom}`), el("span", { class: "discret" }, info));
    }));
    majBoutons();
  }

  boutonSaison.addEventListener("click", () => {
    const saison = saisonCourante();
    const decocher = toutCoche(saison);
    for (const episode of diffuses(saison)) {
      const cle = cleEpisode(saison.numero, episode.numero);
      if (decocher) choisis.delete(cle); else choisis.add(cle);
    }
    dessinerListe();
  });
  boutonJusqua.addEventListener("click", () => {
    const limite = saisonCourante().numero;
    for (const saison of saisons.filter((s) => s.numero > 0 && s.numero <= limite)) {
      for (const episode of diffuses(saison)) choisis.add(cleEpisode(saison.numero, episode.numero));
    }
    dessinerListe();
  });
  selectSaison.addEventListener("change", dessinerListe);

  // Chargement des saisons (le serveur les garde en cache ensuite)
  chargerSaisons(resultat.id_source).then((resultatSaisons) => {
    // Saisons « normales » d'abord, épisodes spéciaux à la fin
    saisons = [...resultatSaisons.filter((s) => s.numero > 0), ...resultatSaisons.filter((s) => s.numero === 0)];
    selectSaison.replaceChildren(...saisons.map((s) => el("option", { value: String(s.numero) },
      s.numero === 0 ? `Bonus : coulisses, résumés… (${s.episodes.length})` : `Saison ${s.numero} (${s.episodes.length} épisode${s.episodes.length > 1 ? "s" : ""})`)));
    selectSaison.disabled = false;
    etatChargement.hidden = true;
    zoneEpisodes.hidden = false;
    dessinerListe();
  }).catch((erreur) => { etatChargement.className = "ko"; etatChargement.textContent = `Épisodes indisponibles : ${erreur.message}`; });

  // Ce qui est fait au clic : on bloque les boutons pendant le travail, on affiche l'erreur éventuelle
  const toutBoutons = [boutonAVoir, boutonDejaVue, boutonEnregistrer];
  const executer = (travail) => async () => {
    toutBoutons.forEach((b) => { b.disabled = true; });
    message.hidden = true;
    try {
      await travail(new FormData(formulaire));
      apres();
    } catch (erreur) {
      message.textContent = erreur.message;
      message.hidden = false;
      toutBoutons.forEach((b) => { b.disabled = false; });
      majBoutons();
    }
  };
  boutonAVoir.addEventListener("click", executer((fd) => ajouterTitreTmdb(resultat, "a_voir", fd)));
  boutonDejaVue.addEventListener("click", executer((fd) => ajouterTitreTmdb(resultat, "vu", fd)));
  boutonEnregistrer.addEventListener("click", executer(async (fd) => {
    const episodes = [...choisis].map((c) => c.split(":").map(Number));
    // « Terminé » si tous les épisodes diffusés sont cochés, sinon « en cours »
    const progression = calculerProgression(saisons, episodes.map(([saison, episode]) => ({ saison, episode })));
    const titre = await pbCreer("titres", {
      source: "tmdb", id_source: resultat.id_source, format_source: "serie", type: fd.get("type"),
      titre: resultat.titre, annee: resultat.annee || 0, statut: progression.complet ? "termine" : "en_cours", vu_avant: false,
    });
    try {
      await enParallele(episodes, ([saison, episode]) => cocherEpisodeSerie(titre.id, saison, episode, fd.get("date"), fd.get("episodes_avant") === "on"), () => {});
    } catch (erreur) {
      await pbSupprimer("titres", titre.id); // tout ou rien : pas de série à moitié enregistrée
      throw erreur;
    }
    bibliotheque.set(cleTitre("serie", resultat.id_source), titre);
    toast(`« ${resultat.titre} » ajoutée avec ${episodes.length} épisode${episodes.length > 1 ? "s" : ""} vu${episodes.length > 1 ? "s" : ""}.`);
  }));

  formulaire.append(
    champsRadio("type", [["serie", "Série"], ["anime", "Animé"]], resultat.anime_probable ? "anime" : "serie", "Type de titre"),
    el("div", { class: "detail-bloc" }, el("h3", {}, "Pas encore vue ?"), boutonAVoir),
    el("div", { class: "detail-bloc" },
      el("h3", {}, "J'ai vu des épisodes"),
      etatChargement,
      zoneEpisodes),
    el("div", { class: "detail-bloc" }, el("h3", {}, "Déjà vue en entier ?"),
      el("p", { class: "discret" }, "Enregistrée comme « vue avant » : pas de date, pas d'épisodes précis. Si tu n'en as vu qu'une partie, coche plutôt les épisodes ci-dessus avec « Vu avant, date inconnue »."), boutonDejaVue),
    message);
  // Zone des épisodes : saison, boutons rapides, liste, date puis enregistrement
  zoneEpisodes.append(
    el("div", { class: "champ" }, el("label", {}, "Saison"), selectSaison),
    el("div", { class: "barre-boutons" }, boutonSaison, boutonJusqua),
    creerOptionPrecedents(),
    liste,
    el("div", { class: "champ champ-date" }, el("label", {}, "Date du visionnage (pour les épisodes cochés)"), date,
      el("label", { class: "choix choix-avant", title: "Les épisodes cochés sont enregistrés sans date" }, caseAvant, "Vu avant, date inconnue (ne pas enregistrer de date)")),
    el("div", { class: "barre-enregistrer" }, compteur, boutonEnregistrer));
  return formulaire;
}

// ---------- Fenêtre de détail d'un titre ----------
function ouvrirDetail(resultat, apresAjout) {
  const estFilmTmdb = resultat.format === "film";
  const cle = cleTitre(resultat.format, resultat.id_source);

  // Infos déjà connues par la liste : on les affiche tout de suite, puis on complète
  const meta = el("p", { class: "discret" }, [LIBELLES_TYPE[estFilmTmdb ? "film" : "serie"], resultat.annee].filter(Boolean).join(" · "));
  const recapZone = el("div", { class: "recap-zone" }); // rempli quand les détails complets arrivent
  const synopsis = el("p", { class: "synopsis" }, resultat.synopsis || "Chargement du synopsis…");
  const afficheZone = el("div", { class: "detail-affiche" });
  const dessinerAffiche = (chemin) => {
    const adresse = urlAffiche(chemin, "w342");
    afficheZone.replaceChildren(adresse
      ? el("img", { class: "affiche", src: adresse, alt: `Affiche de ${resultat.titre}` })
      : el("div", { class: "affiche" }, "Pas d'affiche"));
  };
  dessinerAffiche(resultat.affiche);

  const actions = el("div", { class: "detail-actions" });
  const dessinerActions = () => {
    actions.replaceChildren();
    const dejaLa = bibliotheque.get(cle);
    if (dejaLa) {
      actions.append(
        el("p", { class: "badge-bibliotheque" }, icone("check"), `Dans ma bibliothèque · ${LIBELLES_STATUT[dejaLa.statut]}`),
        el("a", { href: `fiche.html?id=${dejaLa.id}`, class: "bouton-lien" }, "Ouvrir ma fiche"));
      return;
    }
    // Série : on peut choisir la saison et cocher les épisodes déjà vus
    if (!estFilmTmdb) {
      actions.append(creerFormulaireSerie(resultat, () => { apresAjout(); dessinerActions(); }));
      return;
    }
    // Un animé peut être un film : le choix dépend du format TMDB.
    const types = [["film", "Film"], ["anime", "Animé"]];
    const formulaire = el("form", { class: "detail-formulaire" });
    const message = el("p", { class: "erreur-dialogue", hidden: true });
    const boutonAVoir = el("button", { type: "button" }, icone("plus"), "Ajouter à voir");
    const boutonVu = el("button", { type: "button", class: "principal" }, icone("check"), "Marquer comme vu");
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

  const fermer = el("button", { type: "button", class: "fermer", "aria-label": "Fermer" }, icone("x"));
  const fenetre = el("dialog", { class: "dialogue-detail" },
    fermer,
    el("div", { class: "detail" }, afficheZone,
      el("div", { class: "detail-infos" }, el("h2", {}, resultat.titre), meta, synopsis, recapZone, actions)));
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
    recapZone.replaceChildren(creerRecapitulatif(d)); // studio, box-office, pays, équipe, distribution...
    // Saga (ex. Avatar 1, 2, 3) : un clic sur un autre film ouvre sa fenêtre à la place de celle-ci
    const saga = creerSaga(d, (film) => { fenetre.close(); ouvrirDetail(film, () => majPastille(film)); },
      (film) => bibliotheque.has(cleTitre("film", film.id_source)));
    if (saga) recapZone.append(saga);
    // Titres similaires : un clic ouvre la fenêtre de l'autre titre à la place de celle-ci
    recapZone.append(creerSimilaires(d, (autre) => { fenetre.close(); ouvrirDetail(autre, () => majPastille(autre)); },
      (autre) => bibliotheque.has(cleTitre(autre.format, autre.id_source))));
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
  if (dejaLa) carte.querySelector(".carte-affiche-image").append(el("span", { class: "pastille", title: LIBELLES_STATUT[dejaLa.statut] }, icone("check")));
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
    el("span", { class: "discret" }, sousTitre),
    el("span", { class: "discret carte-pays" })); // le pays arrive juste après (voir completerPays)
  cartes.set(cleTitre(resultat.format, resultat.id_source), carte);
  majPastille(resultat);
  return carte;
}

// Affiche le pays de production sous chaque affiche. Les listes filtrées le connaissent déjà ;
// pour les autres, on le demande au serveur par lots (il le garde ensuite en cache).
function afficherPays(resultat, codes) {
  const zone = cartes.get(cleTitre(resultat.format, resultat.id_source))?.querySelector(".carte-pays");
  if (zone) zone.textContent = nomsDePays(codes).slice(0, 2).join(", ");
}

async function completerPays(resultats) {
  const inconnus = [];
  for (const resultat of resultats) {
    if (resultat.pays) afficherPays(resultat, resultat.pays);
    else inconnus.push(resultat);
  }
  for (let debut = 0; debut < inconnus.length; debut += 12) {
    const lot = inconnus.slice(debut, debut + 12);
    try {
      const pays = await source(`pays?ids=${lot.map((r) => cleTitre(r.format, r.id_source)).join(",")}`);
      lot.forEach((r) => { const codes = pays[cleTitre(r.format, r.id_source)]; if (codes) afficherPays(r, codes); });
    } catch (erreur) { /* pas de pays affiché : sans gravité */ }
  }
}

// ---------- Défilement infini ----------
const parametres = new URLSearchParams(location.search);
const texteRecherche = (parametres.get("q") || "").trim();
// Recherche d'une personne depuis la barre du haut (?qp=nom&prole=acteur) : on affiche la liste des personnes
const textePersonne = (parametres.get("qp") || "").trim();
const ROLES_PERSONNE = { acteur: "Acteur", realisateur: "Réalisateur", producteur: "Producteur" };
const rolePersonne = (valeur) => (ROLES_PERSONNE[valeur] ? valeur : "acteur");
const categorieChoisie = CATEGORIES.some(([cle]) => cle === parametres.get("categorie")) ? parametres.get("categorie") : "tendances";
// Ce que chaque onglet « se balader » représente : les filtres s'ajoutent à cette base
// (ex. « Séries les mieux notées » + exclure « Animation » = les séries les mieux notées sans animation)
const BASES_CATEGORIES = {
  tendances: { type: "tous", tri: "populaires" },
  films_a_l_affiche: { type: "film", tri: "populaires", depuisJours: 60 },
  films_populaires: { type: "film", tri: "populaires" },
  series_populaires: { type: "serie", tri: "populaires" },
  films_mieux_notes: { type: "film", tri: "mieux_notes" },
  series_mieux_notees: { type: "serie", tri: "mieux_notes" },
};
const baseCategorie = (!parametres.get("q") && BASES_CATEGORIES[categorieChoisie]) || BASES_CATEGORIES.tendances;

// ---------- Filtres : inclure / exclure ----------
// Les choix se lisent dans l'adresse de la page (?type=film&gi=drame&ge=horreur&pe=asie…) :
//   gi / ge = genres inclus / exclus · pi / pe = pays ou régions inclus / exclus
// Chaque « puce » a 3 états : neutre → inclus (vert) → exclu (rouge) → neutre.
const lireListeUrl = (cle) => (parametres.get(cle) || "").split(",").filter((x) => x);
const etatDepuisUrl = (inclus, exclus) => {
  const etat = {};
  lireListeUrl(inclus).forEach((cle) => { etat[cle] = 1; });
  lireListeUrl(exclus).forEach((cle) => { etat[cle] = -1; });
  return etat;
};
const filtres = {
  type: ["film", "serie", "tous"].includes(parametres.get("type")) ? parametres.get("type") : baseCategorie.type,
  genres: etatDepuisUrl("gi", "ge"),
  pays: etatDepuisUrl("pi", "pe"),
  themes: etatDepuisUrl("ti", "te"),
  anneeMin: (parametres.get("amin") || "").replace(/\D/g, "").slice(0, 4),
  anneeMax: (parametres.get("amax") || "").replace(/\D/g, "").slice(0, 4),
  tri: ["populaires", "mieux_notes", "recents"].includes(parametres.get("tri")) ? parametres.get("tri") : baseCategorie.tri,
  // Studio ou chaîne choisi (lien depuis une fiche) : { id, nom, type: "studio" | "chaine" } (ou null)
  societe: /^[0-9]+$/.test(parametres.get("soc") || "")
    ? { id: parametres.get("soc"), nom: (parametres.get("snom") || "").slice(0, 80), type: parametres.get("stype") === "chaine" ? "chaine" : "studio" }
    : null,
  // Acteur ou réalisateur choisi : { id, nom, role: "acteur" | "realisateur" | "producteur" } (ou null)
  personne: /^[0-9]+$/.test(parametres.get("pers") || "")
    ? { id: parametres.get("pers"), nom: (parametres.get("pnom") || "").slice(0, 80), role: rolePersonne(parametres.get("prole")) }
    : null,
};
// Pendant une recherche par nom, les filtres servent à retirer ce qui n'intéresse pas (type, genres, pays, années)
const clesFiltres = texteRecherche ? ["type", "gi", "ge", "pi", "pe", "amin", "amax"] : ["type", "gi", "ge", "pi", "pe", "ti", "te", "amin", "amax", "tri", "pers", "soc"];
const filtresActifs = clesFiltres.some((cle) => parametres.has(cle));
if (texteRecherche) { filtres.personne = null; filtres.societe = null; filtres.themes = {}; filtres.tri = "populaires"; }
// Les filtres s'ajoutent à l'onglet choisi : on n'a donc plus besoin d'écrire le type / le tri de l'onglet dans l'adresse

const TRIS = { populaires: "Les plus populaires", mieux_notes: "Les mieux notés", recents: "Les plus récents" };
const cleDe = (etat, valeur) => Object.keys(etat).filter((cle) => etat[cle] === valeur).join(",");

// Paramètres envoyés au serveur (route « explorer »)
function parametresExplorer(page) {
  const p = new URLSearchParams({ type: filtres.type, tri: filtres.tri, page });
  [["genres_inclus", cleDe(filtres.genres, 1)], ["genres_exclus", cleDe(filtres.genres, -1)],
    ["pays_inclus", cleDe(filtres.pays, 1)], ["pays_exclus", cleDe(filtres.pays, -1)],
    ["themes_inclus", cleDe(filtres.themes, 1)], ["themes_exclus", cleDe(filtres.themes, -1)],
    ["annee_min", filtres.anneeMin], ["annee_max", filtres.anneeMax]].forEach(([nom, valeur]) => { if (valeur) p.set(nom, valeur); });
  if (filtres.personne) { p.set("personne_id", filtres.personne.id); p.set("personne_role", filtres.personne.role); }
  if (filtres.societe) { p.set("societe_id", filtres.societe.id); p.set("societe_type", filtres.societe.type); }
  if (baseCategorie.depuisJours && filtres.tri === baseCategorie.tri) p.set("depuis_jours", baseCategorie.depuisJours);
  return p.toString();
}

// Adresse de la page pour les filtres choisis (seulement ce qui diffère de la valeur par défaut)
function adresseFiltres() {
  const p = new URLSearchParams();
  if (texteRecherche) p.set("q", texteRecherche);
  if (categorieChoisie !== "tendances" && !texteRecherche) p.set("categorie", categorieChoisie);
  if (filtres.type !== baseCategorie.type) p.set("type", filtres.type);
  [["gi", cleDe(filtres.genres, 1)], ["ge", cleDe(filtres.genres, -1)], ["pi", cleDe(filtres.pays, 1)], ["pe", cleDe(filtres.pays, -1)],
    ["ti", cleDe(filtres.themes, 1)], ["te", cleDe(filtres.themes, -1)], ["amin", filtres.anneeMin], ["amax", filtres.anneeMax]].forEach(([nom, valeur]) => { if (valeur) p.set(nom, valeur); });
  if (filtres.tri !== baseCategorie.tri) p.set("tri", filtres.tri);
  if (filtres.personne) { p.set("pers", filtres.personne.id); p.set("pnom", filtres.personne.nom); p.set("prole", filtres.personne.role); }
  if (filtres.societe) { p.set("soc", filtres.societe.id); p.set("snom", filtres.societe.nom); p.set("stype", filtres.societe.type); }
  return p.toString() ? `catalogue.html?${p}` : "catalogue.html";
}

const nombreFiltres = () => Object.keys(filtres.genres).length + Object.keys(filtres.pays).length + Object.keys(filtres.themes).length
  + (filtres.type !== baseCategorie.type ? 1 : 0) + (filtres.anneeMin || filtres.anneeMax ? 1 : 0) + (filtres.tri !== baseCategorie.tri ? 1 : 0)
  + (filtres.personne ? 1 : 0) + (filtres.societe ? 1 : 0);

// Une phrase qui résume les filtres actifs (affichée au-dessus de la grille)
function resumeFiltres(choix) {
  const nom = (cle) => (choix.genres.concat(choix.pays, choix.regions, choix.themes || []).find((x) => x.cle === cle) || {}).libelle || (/^[A-Z]{2}$/.test(cle) ? nomPays(cle) : cle);
  const liste = (a, b) => [a, b].join(",").split(",").filter((x) => x).map(nom);
  const parties = [];
  if (filtres.type !== "tous" && filtres.type !== baseCategorie.type) parties.push(filtres.type === "film" ? "films" : "séries");
  if (filtres.personne) parties.push(`${{ realisateur: "réalisés par", producteur: "produits par", acteur: "avec" }[filtres.personne.role]} ${filtres.personne.nom}`);
  if (filtres.societe) parties.push(`${filtres.societe.type === "chaine" ? "diffusés sur" : "du studio"} ${filtres.societe.nom}`);
  const inclus = liste(cleDe(filtres.genres, 1), cleDe(filtres.pays, 1)).concat(liste(cleDe(filtres.themes, 1), ""));
  const exclus = liste(cleDe(filtres.genres, -1), cleDe(filtres.pays, -1)).concat(liste(cleDe(filtres.themes, -1), ""));
  if (inclus.length) parties.push(`avec : ${inclus.join(", ")}`);
  if (exclus.length) parties.push(`sans : ${exclus.join(", ")}`);
  if (filtres.anneeMin || filtres.anneeMax) parties.push(`${filtres.anneeMin || "…"} – ${filtres.anneeMax || "…"}`);
  if (!texteRecherche && filtres.tri !== baseCategorie.tri) parties.push(TRIS[filtres.tri].toLowerCase()); // le tri n'existe pas pendant une recherche par nom
  return parties.join(" · ");
}

// Une personne trouvée, sous forme de bouton (photo, nom, métier, titres connus)
function boutonPersonne(p, role, auClic) {
  const adresse = urlAffiche(p.photo, "w185");
  return el("button", { type: "button", class: "personne-trouvee", onclick: auClic },
    adresse ? el("img", { class: "personne-photo", src: adresse, alt: "", loading: "lazy" }) : el("span", { class: "personne-photo personne-initiales" }, initiales(p.nom)),
    el("span", { class: "personne-trouvee-texte" }, el("strong", {}, p.nom),
      el("span", { class: "discret" }, [ROLES_PERSONNE[p.metier] || "", ...p.connu_pour.slice(0, 2)].filter((x) => x).join(" · "))));
}

// Champ « Acteur, réalisateur ou producteur » : on tape un nom, on choisit la bonne personne, puis son rôle
function creerChampPersonne(majCompteur) {
  const saisie = el("input", { type: "search", placeholder: "Nom d'un acteur, réalisateur ou producteur…", "aria-label": "Nom d'une personne" });
  const boutonChercher = el("button", { type: "button" }, icone("search"), "Chercher");
  const trouvees = el("div", { class: "personnes-trouvees" });
  const choisie = el("div", { class: "personne-choisie" });

  function dessinerChoix() {
    choisie.replaceChildren();
    const p = filtres.personne;
    if (!p) return;
    const roles = champsRadio("role_personne", [["acteur", "Acteur (rôles principaux)"], ["realisateur", "Réalisateur"], ["producteur", "Producteur"]], p.role, "Rôle recherché");
    roles.addEventListener("change", (e) => { p.role = e.target.value; });
    choisie.append(
      el("p", { class: "personne-etiquette" }, icone("check"), el("strong", {}, p.nom),
        el("button", { type: "button", class: "lien", onclick: () => { filtres.personne = null; dessinerChoix(); majCompteur(); } }, "Retirer")),
      roles);
  }

  async function chercher() {
    const texte = saisie.value.trim();
    if (!texte) return;
    trouvees.replaceChildren(el("p", { class: "discret" }, "Recherche…"));
    try {
      const liste = await source(`personnes?q=${encodeURIComponent(texte)}`);
      trouvees.replaceChildren(...(liste.length ? liste.map((p) => boutonPersonne(p, p.metier, () => {
        filtres.personne = { id: p.id, nom: p.nom, role: rolePersonne(p.metier) };
        trouvees.replaceChildren();
        saisie.value = "";
        dessinerChoix();
        majCompteur();
      })) : [el("p", { class: "discret" }, "Personne introuvable. Vérifie l'orthographe.")]));
    } catch (erreur) {
      trouvees.replaceChildren(el("p", { class: "ko" }, erreur.message));
    }
  }
  boutonChercher.addEventListener("click", chercher);
  saisie.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chercher(); } });

  dessinerChoix();
  return el("div", { class: "champ champ-personne" }, el("label", {}, "Acteur ou réalisateur"),
    el("div", { class: "recherche-personne" }, saisie, boutonChercher), trouvees, choisie);
}

function construirePanneauFiltres(choix) {
  const compteur = el("span", { class: "compteur-filtres" });
  const majCompteur = () => { const n = nombreFiltres(); compteur.textContent = n ? String(n) : ""; compteur.hidden = !n; };
  const groupePuces = (liste, etat) => el("div", { class: "puces" }, liste.map((x) => creerPuce(x.libelle, etat, x.cle, majCompteur)));

  const radiosType = champsRadio("type_filtre", [["tous", "Films et séries"], ["film", "Films"], ["serie", "Séries"]], filtres.type, "Type");
  radiosType.addEventListener("change", (e) => { filtres.type = e.target.value; majCompteur(); });
  const champAnnee = (nom, cleFiltre, repere) => {
    const champ = el("input", { type: "number", inputmode: "numeric", min: "1900", max: "2100", placeholder: repere, value: filtres[cleFiltre] || null, "aria-label": nom });
    champ.addEventListener("input", () => { filtres[cleFiltre] = champ.value.slice(0, 4); majCompteur(); });
    return champ;
  };
  const choixTri = el("select", { "aria-label": "Trier par" }, Object.entries(TRIS).map(([cle, libelle]) => el("option", { value: cle, selected: cle === filtres.tri }, libelle)));
  choixTri.addEventListener("change", () => { filtres.tri = choixTri.value; majCompteur(); });

  const corps = el("div", { class: "filtres-corps" },
    el("p", { class: "discret" }, "Clique une fois sur une puce pour l'inclure (elle devient verte), deux fois pour l'exclure (rouge), trois fois pour la retirer."),
    radiosType,
    texteRecherche ? el("p", { class: "discret" }, "Ces filtres retirent des résultats de ta recherche ce qui ne t'intéresse pas.") : creerChampPersonne(majCompteur),
    filtres.societe ? el("div", { class: "champ" }, el("label", {}, filtres.societe.type === "chaine" ? "Chaîne / plateforme" : "Studio"),
      el("p", { class: "personne-etiquette" }, icone("check"), el("strong", {}, filtres.societe.nom),
        el("button", { type: "button", class: "lien", onclick: () => { filtres.societe = null; location.href = adresseFiltres(); } }, "Retirer"))) : null,
    el("div", { class: "champ" }, el("label", {}, "Genres (le titre doit avoir tous les genres inclus)"), groupePuces(choix.genres, filtres.genres),
      el("p", { class: "discret" }, "Horreur, Thriller, Romance, Histoire et Musique n'existent que pour les films : les inclure masque les séries.")),
    texteRecherche || !(choix.themes || []).length ? null : el("div", { class: "champ" }, el("label", {}, "Thèmes (au moins un des thèmes inclus)"), groupePuces(choix.themes, filtres.themes)),
    el("div", { class: "champ" }, el("label", {}, "Régions (au moins une des régions incluses)"), groupePuces(choix.regions, filtres.pays)),
    el("div", { class: "champ" }, el("label", {}, "Pays de production"), groupePuces(choix.pays, filtres.pays)),
    el("div", { class: "ligne-filtres" },
      el("div", { class: "champ" }, el("label", {}, "Années de sortie"),
        el("div", { class: "champ-annees" }, champAnnee("Année minimum", "anneeMin", "de"), el("span", { class: "discret" }, "à"), champAnnee("Année maximum", "anneeMax", "à"))),
      texteRecherche ? null : el("div", { class: "champ" }, el("label", {}, "Trier par"), choixTri)),
    el("div", { class: "boutons-filtres" },
      el("button", { type: "button", class: "principal", onclick: () => { location.href = adresseFiltres(); } }, "Appliquer les filtres"),
      el("button", { type: "button", onclick: () => { location.href = texteRecherche ? `catalogue.html?q=${encodeURIComponent(texteRecherche)}` : categorieChoisie !== "tendances" ? `catalogue.html?categorie=${categorieChoisie}` : "catalogue.html"; } }, "Réinitialiser")));

  const panneau = el("details", { class: "panneau-filtres" }, el("summary", {}, "Filtres", compteur), corps);
  majCompteur();
  document.getElementById("categories").after(panneau);
}

const etat = { page: 0, totalPages: 1, enCours: false, dejaVus: new Set(), erreur: false };
const sentinelle = document.getElementById("sentinelle");

async function chargerPageSuivante() {
  if (etat.enCours || etat.page >= etat.totalPages) return;
  etat.enCours = true;
  etat.erreur = false;
  const page = etat.page + 1;
  try {
    const url = texteRecherche
      ? `rechercher?q=${encodeURIComponent(texteRecherche)}&${parametresExplorer(page)}`
      : filtresActifs
        ? `explorer?${parametresExplorer(page)}`
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
    completerPays(nouveaux);

    if (texteRecherche && !etat.dejaVus.size && etat.page >= etat.totalPages) {
      message.textContent = filtresActifs
        ? `Aucun résultat pour « ${texteRecherche} » avec ces filtres. Essaie d'en retirer un.`
        : `Aucun résultat pour « ${texteRecherche} ». Tu peux l'ajouter manuellement.`;
    } else if (filtresActifs && !etat.dejaVus.size && etat.page >= etat.totalPages) {
      message.textContent = "Aucun titre ne correspond à ces filtres. Essaie d'en retirer un.";
    } else if (etat.page >= etat.totalPages) {
      message.textContent = "Tu as tout vu : fin de la liste.";
    } else {
      message.textContent = filtresActifs && !etat.dejaVus.size ? "Recherche des titres correspondants…" : "";
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
      el("span", { class: "discret", id: "resume-filtres" }, `Résultats pour « ${texteRecherche} » `),
      el("a", { href: "catalogue.html" }, icone("arrow-left"), "Revenir à la découverte"));
    return;
  }
  // Changer d'onglet garde les filtres (genres, pays, thèmes, années, personne, studio) mais prend le type et le tri du nouvel onglet
  const adresseOnglet = (cle) => {
    const p = new URLSearchParams(location.search);
    ["categorie", "type", "tri", "ouvrir"].forEach((nom) => p.delete(nom));
    if (cle !== "tendances") p.set("categorie", cle);
    return p.toString() ? `catalogue.html?${p}` : "catalogue.html";
  };
  if (filtresActifs) {
    // Le résumé des filtres est complété quand les choix de filtres sont chargés (voir plus bas)
    zone.after(el("p", { class: "discret", id: "resume-filtres" }, "Résultats filtrés "));
  }
  zone.replaceChildren(...CATEGORIES.map(([cle, libelle]) =>
    el("a", { href: filtresActifs ? adresseOnglet(cle) : `catalogue.html?categorie=${cle}`, class: `pastille-categorie${cle === categorieChoisie ? " active" : ""}`, "aria-current": cle === categorieChoisie ? "true" : null }, libelle)));
}

document.getElementById("bouton-manuel").addEventListener("click", ouvrirAjoutManuel);

// Liste des personnes qui portent le nom tapé dans la barre du haut : un clic ouvre leurs titres
async function afficherPersonnes() {
  const role = rolePersonne(parametres.get("prole"));
  document.getElementById("categories").replaceChildren(
    el("span", { class: "discret" }, `${ROLES_PERSONNE[role]}s pour « ${textePersonne} » `),
    el("a", { href: "catalogue.html" }, icone("arrow-left"), "Revenir à la découverte"));
  const zone = el("div", { class: "personnes-trouvees personnes-resultats" });
  grille.replaceWith(zone);
  message.textContent = "Recherche…";
  try {
    const liste = await source(`personnes?q=${encodeURIComponent(textePersonne)}&metier=${role}`);
    message.textContent = liste.length ? "Clique sur une personne pour voir ses titres." : `Aucun ${ROLES_PERSONNE[role].toLowerCase()} trouvé pour « ${textePersonne} ». Vérifie l'orthographe ou change le filtre de recherche.`;
    zone.append(...liste.map((p) => boutonPersonne(p, role, () => { location.href = adressePersonne(p, role); })));
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

// « Saga vue » : on coche les films voulus, puis ils deviennent « vu avant » (sans date).
// Les films déjà vus sont verrouillés (cochés, grisés) et ne bougent pas ; ceux que l'on ne coche pas ne sont pas touchés.
const estVu = (film) => { const t = bibliotheque.get(cleTitre(film.format, film.id_source)); return !!t && (t.vu_avant || t.statut === "termine"); };

function ouvrirMarquerSelection(aFaire, dejaVus, apres) {
  const dejaDans = aFaire.filter((f) => bibliotheque.has(cleTitre(f.format, f.id_source))).length;
  const s = (n, un, plusieurs) => (n > 1 ? plusieurs : un);
  ouvrirDialogue({
    titre: "Marquer ces films comme vus ?",
    libelleValider: `Marquer ${aFaire.length} film${s(aFaire.length, "", "s")} comme vu${s(aFaire.length, "", "s")}`,
    remplir: (formulaire) => formulaire.append(...[
      el("p", {}, `${aFaire.length} film${s(aFaire.length, " sera", "s seront")} enregistré${s(aFaire.length, "", "s")} « vu avant » (sans date), et ajouté${s(aFaire.length, "", "s")} à ta bibliothèque s'il n'y est pas déjà.`),
      el("ul", { class: "discret" }, aFaire.map((f) => el("li", {}, `${f.titre}${f.annee ? ` (${f.annee})` : " (pas encore sorti ?)"}`))),
      dejaDans ? el("p", { class: "discret" }, `${dejaDans} ${s(dejaDans, "est", "sont")} déjà dans ta bibliothèque (à voir, en cours…) : ${s(dejaDans, "il passe", "ils passent")} à « terminé ».`) : null,
      dejaVus ? el("p", { class: "discret" }, `${dejaVus} film${s(dejaVus, "", "s")} déjà vu${s(dejaVus, "", "s")} ne change${s(dejaVus, "", "nt")} pas.`) : null].filter(Boolean)),
    valider: async () => {
      await enParallele(aFaire, async (f) => {
        const existant = bibliotheque.get(cleTitre(f.format, f.id_source));
        if (existant) {
          bibliotheque.set(cleTitre(f.format, f.id_source), await pbModifier("titres", existant.id, { vu_avant: true, statut: "termine" }));
        } else {
          const titre = await pbCreer("titres", {
            source: "tmdb", id_source: f.id_source, format_source: "film", type: "film",
            titre: f.titre, annee: f.annee || 0, statut: "termine", vu_avant: true,
          });
          bibliotheque.set(cleTitre(f.format, f.id_source), titre);
          source(`details/film/${f.id_source}`).catch(() => {}); // prépare le cache
        }
        majPastille(f);
      }, () => {});
      toast(`${aFaire.length} film${s(aFaire.length, "", "s")} marqué${s(aFaire.length, "", "s")} comme vu${s(aFaire.length, "", "s")} (avant).`);
      apres();
    },
  });
}

// Barre et cases à cocher de la page d'une saga
function preparerSelectionSaga(films, cartesFilms) {
  const anneeEnCours = new Date().getFullYear();
  const cle = (f) => cleTitre(f.format, f.id_source);
  // Au départ : tous les films déjà sortis qui ne sont pas encore vus (on décoche ceux qu'on n'a pas vus,
  // et on peut cocher à la main un film pas encore sorti)
  const choisis = new Set(films.filter((f) => !estVu(f) && f.annee && f.annee <= anneeEnCours).map(cle));
  const cases = new Map();
  const enveloppes = [];
  const compteur = el("span", { class: "discret" });
  const boutonMarquer = el("button", { type: "button", class: "principal" });

  const majBarre = () => {
    const n = films.filter((f) => !estVu(f) && choisis.has(cle(f))).length;
    boutonMarquer.replaceChildren(icone("check"), n ? `Marquer ${n} film${n > 1 ? "s" : ""} comme vu${n > 1 ? "s" : ""}` : "Aucun film coché");
    boutonMarquer.disabled = !n;
    const vus = films.filter(estVu).length;
    compteur.textContent = `${n} coché${n > 1 ? "s" : ""} · ${vus} déjà vu${vus > 1 ? "s" : ""} · ${films.length} au total`;
  };
  const majCases = () => {
    films.forEach((f) => {
      const c = cases.get(cle(f));
      const vu = estVu(f);
      c.checked = vu || choisis.has(cle(f));
      c.disabled = vu;
      c.closest("label").title = vu ? "Déjà vu" : "Cocher pour le marquer comme vu";
    });
    majBarre();
  };

  films.forEach((f) => {
    const c = el("input", { type: "checkbox", "aria-label": `${f.titre} : vu` });
    c.addEventListener("change", () => { if (c.checked) choisis.add(cle(f)); else choisis.delete(cle(f)); majBarre(); });
    cases.set(cle(f), c);
    const enveloppe = el("div", { class: "carte-cochable" }, cartesFilms.get(cle(f)), el("label", { class: "case-vu" }, c, el("span", {}, "Vu")));
    enveloppes.push(enveloppe);
  });

  boutonMarquer.addEventListener("click", () => {
    const aFaire = films.filter((f) => !estVu(f) && choisis.has(cle(f)));
    if (aFaire.length) ouvrirMarquerSelection(aFaire, films.filter(estVu).length, () => { aFaire.forEach((f) => choisis.delete(cle(f))); majCases(); });
  });
  const toutCocher = el("button", { type: "button", class: "contour", onclick: () => { films.filter((f) => !estVu(f)).forEach((f) => choisis.add(cle(f))); majCases(); } }, "Tout cocher");
  const toutDecocher = el("button", { type: "button", class: "contour", onclick: () => { choisis.clear(); majCases(); } }, "Tout décocher");
  majCases();
  const barre = el("div", { class: "barre-saga" }, boutonMarquer, toutCocher, toutDecocher, compteur,
    el("span", { class: "discret barre-saga-aide" }, "Coche les films que tu as vus (même un film pas encore sorti) : ils seront enregistrés « vu avant », sans date."));
  return { barre, enveloppes };
}

// Une saga (?saga=ID) : tous ses films dans l'ordre de sortie
const idSaga = /^[0-9]+$/.test(parametres.get("saga") || "") ? parametres.get("saga") : "";
async function afficherSaga() {
  document.getElementById("categories").replaceChildren(
    el("span", { class: "discret", id: "titre-saga" }, "Saga "),
    el("a", { href: "catalogue.html?categorie=sagas" }, icone("arrow-left"), "Toutes les sagas"));
  message.textContent = "Chargement…";
  try {
    const [s] = await Promise.all([source(`saga/${idSaga}`), chargerBibliotheque()]);
    document.getElementById("titre-saga").textContent = `Saga « ${s.nom.replace(/ - Saga$/i, "")} » · ${s.films.length} film${s.films.length > 1 ? "s" : ""}, dans l'ordre de sortie `;
    s.films.forEach(creerCarte); // remplit `cartes` (une carte par film)
    const { barre, enveloppes } = preparerSelectionSaga(s.films, cartes);
    grille.before(barre);
    grille.append(...enveloppes);
    completerPays(s.films);
    message.textContent = "";
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

// L'onglet « Sagas » : les sagas connues, ou le résultat d'une recherche par nom
async function afficherSagas() {
  afficherCategories();
  const recherche = (parametres.get("qs") || "").trim();
  const champ = el("input", { type: "search", placeholder: "Chercher une saga (Star Wars, James Bond…)", "aria-label": "Chercher une saga", value: recherche });
  const formulaire = el("form", { class: "recherche-saga", onsubmit: (e) => { e.preventDefault(); location.href = `catalogue.html?categorie=sagas${champ.value.trim() ? `&qs=${encodeURIComponent(champ.value.trim())}` : ""}`; } },
    champ, el("button", { type: "submit" }, icone("search"), "Chercher"));
  document.getElementById("categories").after(formulaire);
  const zone = el("div", { class: "grille-sagas" });
  grille.replaceWith(zone);
  message.textContent = "Chargement des sagas…";
  try {
    const liste = await source(recherche ? `sagas?q=${encodeURIComponent(recherche)}` : "sagas");
    message.textContent = liste.length ? (recherche ? `Sagas pour « ${recherche} »` : "") : `Aucune saga trouvée pour « ${recherche} ».`;
    zone.append(...liste.map((s) => {
      const adresse = urlAffiche(s.affiche, "w342");
      return el("a", { class: "carte-saga", href: `catalogue.html?saga=${s.id}` },
        adresse ? el("img", { src: adresse, alt: "", loading: "lazy" }) : el("span", { class: "carte-saga-vide" }, s.nom),
        el("strong", {}, s.nom.replace(/ - Saga$/i, "").replace(/ \(Saga\)$/i, "")),
        s.nb_films ? el("span", { class: "discret" }, `${s.nb_films} films`) : null);
    }));
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

if (textePersonne) afficherPersonnes(); else if (idSaga) afficherSaga(); else if (categorieChoisie === "sagas") afficherSagas(); else demarrerCatalogue();

function demarrerCatalogue() {
afficherCategories();
source("filtres").then((choix) => {
  construirePanneauFiltres(choix);
  const resume = document.getElementById("resume-filtres");
  if (resume && filtresActifs) {
    resume.textContent = texteRecherche
      ? `Résultats pour « ${texteRecherche} » · ${resumeFiltres(choix)} `
      : `Résultats filtrés : ${resumeFiltres(choix)} `;
  }
}).catch(() => { /* sans les choix de filtres, le catalogue marche quand même */ });
message.textContent = "Chargement…";
chargerPageSuivante().then(() => {
  // Venu des suggestions de la barre de recherche (?ouvrir=serie:1399) : on ouvre la fiche de ce titre
  const demande = (parametres.get("ouvrir") || "").match(/^(film|serie):([0-9]+)$/);
  if (!demande) return;
  source(`details/${demande[1]}/${demande[2]}`).then((d) => {
    ouvrirDetail(d, () => majPastille(d));
  }).catch(() => { /* titre introuvable : on laisse simplement les résultats */ });
});
}
