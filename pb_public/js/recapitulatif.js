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

function creerPersonne(personne, role) {
  const adresse = urlAffiche(personne.photo, "w185");
  const visage = adresse
    ? el("img", { class: "personne-photo", src: adresse, alt: "", loading: "lazy" })
    : el("span", { class: "personne-photo personne-initiales" }, initiales(personne.nom));
  return el("div", { class: "personne", title: role ? `${personne.nom} — ${role}` : personne.nom },
    visage,
    el("span", { class: "personne-nom" }, personne.nom),
    role ? el("span", { class: "personne-role" }, role) : null);
}

function creerGroupePersonnes(titre, personnes, avecRole) {
  if (!personnes.length) return null;
  return el("div", { class: "recap-groupe" },
    el("h4", {}, titre),
    el("div", { class: "personnes" }, personnes.map((p) => creerPersonne(p, avecRole ? p.role : ""))));
}

function creerTuile(libelle, valeur, details) {
  return el("div", { class: "recap-tuile" },
    el("span", { class: "recap-tuile-libelle" }, libelle),
    el("span", { class: "recap-tuile-valeur" }, valeur),
    details ? el("span", { class: "recap-tuile-details" }, details) : null);
}

// "d" = les détails renvoyés par /api/source/details
function creerRecapitulatif(d) {
  const film = d.format === "film";
  const saisons = (d.saisons || []).filter((s) => s.numero > 0).length;
  const pays = nomsDePays(d.pays);

  const tuiles = [
    creerTuile("Année", d.annee ? String(d.annee) : "—"),
    film
      ? creerTuile("Box-office", d.box_office ? formatMontant(d.box_office) : "—")
      : creerTuile("Saisons", saisons ? String(saisons) : "—"),
    creerTuile("Studio", d.studio || "—"),
    creerTuile("Classification", d.classification ? d.classification.valeur : "—", d.classification ? d.classification.pays === "FR" ? "France" : "États-Unis" : ""),
    creerTuile("Score", d.note_source ? `${d.note_source.toFixed(1)}/10` : "—", d.nb_votes ? `${d.nb_votes} votes` : ""),
    creerTuile("Pays", pays.length ? pays.join(", ") : "—"),
  ];
  tuiles.forEach((t, i) => { if (i === 2 || i === 5) t.classList.add("recap-tuile-texte"); }); // studio et pays : du texte, pas un chiffre

  const acteurs = d.acteurs || [];
  const equipe = [
    creerGroupePersonnes(film ? "Réalisateur" : "Créé par", film ? d.realisateurs || [] : d.createurs || [], false),
    creerGroupePersonnes(film ? "Producteur" : "Producteur exécutif", d.producteurs || [], false),
    creerGroupePersonnes("Acteur principal", acteurs.slice(0, 1), true),
    creerGroupePersonnes("Distribution", acteurs.slice(1), true),
  ].filter((g) => g);

  return el("div", { class: "recap" },
    (d.genres || []).length ? el("div", { class: "recap-genres" }, d.genres.map((g) => el("span", { class: "recap-genre" }, g))) : null,
    el("div", { class: "recap-tuiles" }, tuiles),
    equipe.length ? el("div", { class: "recap-equipe" }, equipe) : null);
}
