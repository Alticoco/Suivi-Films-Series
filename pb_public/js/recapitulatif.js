// Carte récapitulative d'un titre (fenêtre du catalogue et fiche) :
// genres, tuiles (année, box-office, studio, classification, score, pays),
// puis l'équipe (réalisateur ou créateur, producteurs) et la distribution avec photos.
// (Dépend de commun.js : el, urlAffiche)

// Noms de pays en français (« US » → « États-Unis »)
let affichagePays = null;
try { affichagePays = new Intl.DisplayNames(["fr"], { type: "region" }); } catch (erreur) { /* navigateur ancien : on garde les codes */ }
function nomPays(code) {
  try { return affichagePays ? affichagePays.of(code) || code : code; } catch (erreur) { return code; }
}
function nomsDePays(codes) {
  return (codes || []).map(nomPays);
}

// 463517383 → « 464 M$ » ; 1250000000 → « 1,3 Md$ »
function formatMontant(dollars) {
  const arrondi = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  if (dollars >= 1e9) return `${arrondi(dollars / 1e9)} Md$`;
  if (dollars >= 1e6) return `${Math.round(dollars / 1e6)} M$`;
  if (dollars >= 1e3) return `${Math.round(dollars / 1e3)} k$`;
  return `${dollars} $`;
}

function initiales(nom) {
  return nom.split(/\s+/).filter((m) => m).slice(0, 2).map((m) => m[0].toUpperCase()).join("");
}

// "metier" : acteur | realisateur | producteur → le clic ouvre le catalogue avec tout ce qui est lié à cette personne
function creerPersonne(personne, role, metier) {
  const adresse = urlAffiche(personne.photo, "w185");
  const visage = adresse
    ? el("img", { class: "personne-photo", src: adresse, alt: "", loading: "lazy" })
    : el("span", { class: "personne-photo personne-initiales" }, initiales(personne.nom));
  const contenu = [visage,
    el("span", { class: "personne-nom" }, personne.nom),
    role ? el("span", { class: "personne-role" }, role) : null];
  const titre = role ? `${personne.nom} — ${role}` : personne.nom;
  // Fiche ancienne sans identifiant (rechargée au prochain affichage) : simple affichage, pas de lien
  if (!personne.id) return el("div", { class: "personne", title: titre }, contenu);
  return el("a", { class: "personne personne-lien", title: `${titre} : voir tous ses titres`,
    href: `catalogue.html?pers=${personne.id}&pnom=${encodeURIComponent(personne.nom)}&prole=${metier}&cat=${metier}` }, contenu);
}

function creerGroupePersonnes(titre, personnes, avecRole, metier) {
  if (!personnes.length) return null;
  return el("div", { class: "recap-groupe" },
    el("h4", {}, titre),
    el("div", { class: "personnes" }, personnes.map((p) => creerPersonne(p, avecRole ? p.role : "", metier))));
}

// Les classifications d'âge expliquées : [codes, nom, explication]
const CLASSIFICATIONS = {
  FR: {
    titre: "France (cinéma et télévision)",
    note: "Au cinéma, les mentions « moins de 12 / 16 / 18 ans » sont des interdictions à l'entrée ; à la télévision, ce sont des conseils affichés à l'écran.",
    lignes: [
      [["TP", "U"], "Tous publics", "Pour tout le monde, y compris les plus jeunes."],
      [["10"], "Déconseillé aux moins de 10 ans", "Quelques scènes ou thèmes peuvent troubler les plus jeunes."],
      [["12"], "Moins de 12 ans", "Violence, peur ou thèmes sensibles plus marqués."],
      [["16"], "Moins de 16 ans", "Violence, sexualité ou thèmes difficiles."],
      [["18"], "Moins de 18 ans", "Réservé aux adultes : contenu explicite."],
    ],
  },
  USFILM: {
    titre: "États-Unis — films (MPA)",
    note: "Ces mentions sont des recommandations américaines, pas des interdictions légales.",
    lignes: [
      [["G"], "G — General Audiences", "Tous publics."],
      [["PG"], "PG — Parental Guidance", "Accord parental conseillé : certaines scènes peuvent ne pas convenir aux enfants."],
      [["PG-13"], "PG-13", "Déconseillé aux moins de 13 ans sans accompagnement d'un parent."],
      [["R"], "R — Restricted", "Moins de 17 ans accompagnés d'un adulte : violence, langage ou thèmes adultes."],
      [["NC-17"], "NC-17", "Interdit aux 17 ans et moins : contenu pour adultes."],
      [["NR", "UR"], "NR — Non classé", "Aucune classification officielle."],
    ],
  },
  USTV: {
    titre: "États-Unis — séries (TV Parental Guidelines)",
    note: "Ces mentions sont des recommandations américaines, pas des interdictions légales.",
    lignes: [
      [["TV-Y"], "TV-Y", "Adapté à tous les enfants, même les plus petits."],
      [["TV-Y7"], "TV-Y7", "Pour les enfants à partir de 7 ans."],
      [["TV-G"], "TV-G", "Tous publics."],
      [["TV-PG"], "TV-PG", "Accord parental conseillé."],
      [["TV-14"], "TV-14", "Déconseillé aux moins de 14 ans."],
      [["TV-MA"], "TV-MA", "Public adulte (17 ans et plus)."],
    ],
  },
};

// Petite fenêtre d'information sur les classifications d'âge. "actuelle" = { valeur, pays } du titre (ou null),
// pour mettre en évidence la ligne qui le concerne ; le groupe qui le concerne est affiché en premier.
function ouvrirInfoClassifications(actuelle, format) {
  const groupeActuel = !actuelle ? null : actuelle.pays === "FR" ? "FR" : format === "film" ? "USFILM" : "USTV";
  const valeur = actuelle ? String(actuelle.valeur).toUpperCase().replace(/^[-+]/, "") : "";
  const ordre = [groupeActuel, "FR", "USFILM", "USTV"].filter((cle, i, tout) => cle && tout.indexOf(cle) === i);

  const fermer = el("button", { type: "button", class: "principal" }, "Fermer");
  const dialogue = el("dialog", { class: "dialogue-info" },
    el("h2", {}, "Comprendre les classifications d'âge"),
    actuelle
      ? el("p", { class: "info-actuelle" }, `Ce titre : ${actuelle.valeur} (${actuelle.pays === "FR" ? "France" : "États-Unis"})`)
      : el("p", { class: "discret" }, "Aucune classification n'est connue pour ce titre. Voici ce que signifient les principales mentions."),
    ...ordre.map((cle) => {
      const groupe = CLASSIFICATIONS[cle];
      return el("section", { class: "info-groupe" },
        el("h3", {}, groupe.titre),
        el("p", { class: "discret" }, groupe.note),
        el("dl", {}, groupe.lignes.map(([codes, nom, explication]) => {
          const concerne = cle === groupeActuel && codes.indexOf(valeur) !== -1;
          return el("div", { class: `info-ligne${concerne ? " info-ligne-active" : ""}` },
            el("dt", {}, codes.join(" / ")), el("dd", {}, el("strong", {}, nom), el("span", {}, explication)));
        })));
    }),
    el("div", { class: "boutons-dialogue" }, fermer));
  fermer.addEventListener("click", () => dialogue.close());
  dialogue.addEventListener("close", () => dialogue.remove());
  document.body.append(dialogue);
  dialogue.showModal();
}

// "valeur" : du texte, ou une liste de liens [{ texte, href }] (un lien ouvre le catalogue sur tout ce qui partage cette référence)
function creerTuile(libelle, valeur, details, quandClic) {
  const estListeDeLiens = Array.isArray(valeur);
  const contenu = [
    el("span", { class: "recap-tuile-libelle" }, libelle, quandClic ? icone("info") : null),
    el("span", { class: "recap-tuile-valeur" }, estListeDeLiens
      ? valeur.flatMap((lien, i) => [i ? ", " : "", el("a", { class: "lien-reference", href: lien.href, title: lien.titre || "Voir tous les titres liés" }, lien.texte)])
      : valeur),
    details ? el("span", { class: "recap-tuile-details" }, details) : null,
  ];
  // Une tuile cliquable (ex. classification) est un vrai bouton : accessible au clavier
  if (!quandClic) return el("div", { class: "recap-tuile" }, contenu);
  return el("button", { type: "button", class: "recap-tuile recap-tuile-bouton", title: "Cliquer pour comprendre les classifications d'âge", onclick: quandClic }, contenu);
}

// Genre cliqué : on retrouve sa clé de filtre du catalogue d'après son nom (« Action & Adventure » → Action)
async function ouvrirGenre(nom, format) {
  try {
    const choix = await source("filtres");
    const normal = (x) => x.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
    const synonymes = { adventure: "aventure", scifi: "sciencefiction", fantasy: "fantastique", war: "guerre" };
    const voulus = nom.split(" & ").map((m) => normal(synonymes[normal(m)] || m));
    const trouve = choix.genres.find((g) => voulus.includes(normal(g.libelle)));
    if (!trouve) { toast(`« ${nom} » n'a pas de filtre dans le catalogue.`, true); return; }
    location.href = `catalogue.html?type=${format}&gi=${trouve.cle}`;
  } catch (erreur) { toast(erreur.message, true); }
}

// "d" = les détails renvoyés par /api/source/details
function creerRecapitulatif(d) {
  const film = d.format === "film";
  const saisons = (d.saisons || []).filter((s) => s.numero > 0).length;
  const pays = nomsDePays(d.pays);

  const tuiles = [
    // Année : tous les films (ou séries) sortis la même année
    creerTuile("Année", d.annee ? [{ texte: String(d.annee), href: `catalogue.html?type=${d.format}&amin=${d.annee}&amax=${d.annee}`, titre: `Voir ${film ? "les films" : "les séries"} de ${d.annee}` }] : "—"),
    film
      ? creerTuile("Box-office", d.box_office ? formatMontant(d.box_office) : "—")
      : creerTuile("Saisons", saisons ? String(saisons) : "—"),
    // Studio (ou chaîne pour une série) : tous leurs titres. Fiche ancienne sans identifiant : simple texte
    creerTuile(film ? "Studio" : "Chaîne", (d.societes || []).length
      ? d.societes.map((s) => ({ texte: s.nom, titre: `Voir tous les titres de ${s.nom}`,
        href: `catalogue.html?type=${s.type === "chaine" ? "serie" : d.format}&soc=${s.id}&snom=${encodeURIComponent(s.nom)}&stype=${s.type}` }))
      : d.studio || "—"),
    creerTuile("Classification", d.classification ? d.classification.valeur : "—", d.classification ? d.classification.pays === "FR" ? "France" : "États-Unis" : "",
      () => ouvrirInfoClassifications(d.classification, d.format)),
    creerTuile("Score", d.note_source ? `${d.note_source.toFixed(1)}/10` : "—", d.nb_votes ? `${d.nb_votes} votes` : ""),
    creerTuile("Pays", (d.pays || []).length
      ? d.pays.map((code) => ({ texte: nomPays(code), titre: `Voir les ${film ? "films" : "séries"} de ce pays`, href: `catalogue.html?type=${d.format}&pi=${code}` }))
      : "—"),
  ];
  tuiles.forEach((t, i) => { if (i === 2 || i === 5) t.classList.add("recap-tuile-texte"); }); // studio et pays : du texte, pas un chiffre

  // Chaque personne n'apparaît qu'une fois, dans le premier groupe où elle se trouve
  // (réalisateur, puis producteur, puis acteur) : un réalisateur qui produit aussi son film n'est pas répété.
  const dejaMontres = new Set();
  const sansDoublon = (liste) => liste.filter((p) => !dejaMontres.has(p.nom) && dejaMontres.add(p.nom));
  const realisateurs = sansDoublon(film ? d.realisateurs || [] : d.createurs || []);
  const producteurs = sansDoublon(d.producteurs || []);
  const acteurs = d.acteurs || [];
  const vedette = acteurs.length && !dejaMontres.has(acteurs[0].nom) ? sansDoublon([acteurs[0]]) : []; // pas de promotion d'un second rôle
  if (acteurs.length) dejaMontres.add(acteurs[0].nom);
  const distribution = sansDoublon(acteurs.slice(1));
  const equipe = [
    creerGroupePersonnes(film ? "Réalisateur" : "Créé par", realisateurs, false, "realisateur"),
    creerGroupePersonnes(film ? "Producteur" : "Producteur exécutif", producteurs, false, "producteur"),
    creerGroupePersonnes("Acteur principal", vedette, true, "acteur"),
    creerGroupePersonnes("Distribution", distribution, true, "acteur"),
  ].filter((g) => g);

  return el("div", { class: "recap" },
    (d.genres || []).length ? el("div", { class: "recap-genres" }, d.genres.map((g) => el("a", { class: "recap-genre lien-reference", href: "#", title: `Voir tout ce qui est « ${g} »`, onclick: (e) => { e.preventDefault(); ouvrirGenre(g, d.format); } }, g))) : null,
    el("div", { class: "recap-tuiles" }, tuiles),
    equipe.length ? el("div", { class: "recap-equipe" }, equipe) : null);
}

// Les autres films de la saga (ex. Avatar 1, 2, 3) : on passe de l'un à l'autre en un clic.
// "choisir(film)" est appelée au clic sur un film ; "dejaDansLaBibliotheque(film)" (facultatif) ajoute une coche.
// Renvoie null si le film ne fait pas partie d'une saga ; la zone reste cachée tant qu'on n'a pas la liste.
function creerSaga(d, choisir, dejaDansLaBibliotheque) {
  if (!d.collection) return null;
  const zone = el("div", { class: "saga", hidden: true });
  source(`saga/${d.collection.id}`).then((saga) => {
    if (saga.films.length < 2) return; // une saga d'un seul film : rien à montrer
    const nom = saga.nom.replace(/\s*[-–]\s*(Saga|Collection|Trilogie)\s*$/i, "");
    zone.replaceChildren(
      el("h4", {}, `Saga ${nom} · ${saga.films.length} films`),
      el("div", { class: "saga-films" }, saga.films.map((film) => {
        const courant = film.id_source === d.id_source;
        const adresse = urlAffiche(film.affiche, "w185");
        return el("button", {
          type: "button", class: `saga-film${courant ? " saga-courant" : ""}`, disabled: courant,
          title: courant ? "Le film affiché" : `Voir « ${film.titre} »`,
          onclick: () => choisir(film),
        },
          el("span", { class: "saga-affiche-cadre" },
            adresse ? el("img", { class: "saga-affiche", src: adresse, alt: "", loading: "lazy" }) : el("span", { class: "saga-affiche saga-sans-affiche" }, "Pas d'affiche"),
            dejaDansLaBibliotheque && dejaDansLaBibliotheque(film) ? el("span", { class: "pastille", title: "Dans ma bibliothèque" }, icone("check")) : null),
          el("span", { class: "saga-titre" }, film.titre),
          el("span", { class: "saga-annee" }, courant ? "Ce film" : film.annee ? String(film.annee) : "à venir"));
      })));
    zone.hidden = false;
  }).catch(() => { /* la saga est un petit plus : sans elle, la fiche s'affiche quand même */ });
  return zone;
}
