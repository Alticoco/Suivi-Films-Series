// Import d'un fichier Excel exporté par l'appli (cahier des charges, section 8).
// Trois temps :
//  1. lireFichierImport()   : lit et VÉRIFIE le fichier (rien n'est modifié)
//  2. apercuImport()        : compare avec ma bibliothèque (« X titres, Y visionnages »)
//  3. appliquerImport()     : « fusionner » (sans doublons) ou « remplacer tout »
// L'habillage TMDB (affiches, synopsis...) n'est pas dans le fichier : il se recharge tout seul.
// (Dépend de commun.js et export.js)

// ---------- Lecture des cellules ----------
const sansAccent = (texte) => String(texte).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Je retrouve le code (film, serie, a_voir...) à partir du libellé affiché dans le fichier.
function inverser(libelles) {
  const table = new Map();
  for (const [code, libelle] of Object.entries(libelles)) {
    table.set(sansAccent(libelle), code);
    table.set(sansAccent(code.replace("_", " ")), code);
  }
  return table;
}
const TYPES_PAR_TEXTE = inverser(LIBELLES_TYPE);
const STATUTS_PAR_TEXTE = inverser(LIBELLES_STATUT);

const nombre = (valeur) => {
  const n = Number(String(valeur).replace(",", "."));
  return valeur === "" || Number.isNaN(n) ? 0 : n;
};
const texte = (valeur) => (valeur === null || valeur === undefined ? "" : String(valeur));

// jj/mm/aaaa, aaaa-mm-jj, ou vraie date Excel → "AAAA-MM-JJ" (null si illisible)
function lireDate(valeur) {
  if (valeur instanceof Date) {
    const d = new Date(valeur.getTime() + 12 * 3600 * 1000); // évite un décalage d'un jour dû au fuseau horaire
    return d.toISOString().slice(0, 10);
  }
  const s = String(valeur).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// "tmdb:serie:1399" → {source, format, idSource} ; "manuel:abc" → {source:"manuel", idInterne}
function lireIdentifiant(brut) {
  const parties = texte(brut).trim().split(":");
  if (parties[0] === "tmdb" && parties.length === 3 && ["film", "serie"].includes(parties[1]) && parties[2]) {
    return { source: "tmdb", format: parties[1], idSource: parties[2] };
  }
  if (parties[0] === "manuel" && parties.length === 2 && parties[1]) return { source: "manuel", idInterne: parties[1] };
  return null;
}

function trouverFeuille(classeur, nom) {
  const vrai = classeur.SheetNames.find((n) => sansAccent(n) === sansAccent(nom));
  return vrai ? classeur.Sheets[vrai] : null;
}

// ---------- 1. Lecture et vérification ----------
async function lireFichierImport(fichier) {
  await chargerXlsx();
  const erreurs = [];
  let classeur;
  try {
    classeur = XLSX.read(await fichier.arrayBuffer(), { type: "array", cellDates: true });
  } catch (erreur) {
    throw new Error("Ce fichier n'est pas un fichier Excel (.xlsx) valide.");
  }
  const feuilleTitres = trouverFeuille(classeur, FEUILLE_TITRES);
  const feuilleHistorique = trouverFeuille(classeur, FEUILLE_HISTORIQUE);
  if (!feuilleTitres || !feuilleHistorique) {
    throw new Error(`Ce fichier ne ressemble pas à un export de l'appli : les feuilles « ${FEUILLE_TITRES} » et « ${FEUILLE_HISTORIQUE} » sont introuvables.`);
  }
  const lignesTitres = XLSX.utils.sheet_to_json(feuilleTitres, { defval: "" });
  const lignesHistorique = XLSX.utils.sheet_to_json(feuilleHistorique, { defval: "" });

  // --- Mes titres ---
  const titres = new Map(); // identifiant → titre
  lignesTitres.forEach((ligne, i) => {
    const numero = i + 2; // numéro de ligne dans Excel (la ligne 1 = les en-têtes)
    if (!texte(ligne["Titre"]).trim() && !texte(ligne["Identifiant"]).trim()) return; // ligne vide
    const id = lireIdentifiant(ligne["Identifiant"]);
    const type = TYPES_PAR_TEXTE.get(sansAccent(ligne["Type"]));
    const statut = STATUTS_PAR_TEXTE.get(sansAccent(ligne["Statut"]));
    if (!id) return erreurs.push(`« ${FEUILLE_TITRES} », ligne ${numero} : identifiant illisible (« ${texte(ligne["Identifiant"])} »).`);
    if (!texte(ligne["Titre"]).trim()) return erreurs.push(`« ${FEUILLE_TITRES} », ligne ${numero} : titre manquant.`);
    if (!type) return erreurs.push(`« ${FEUILLE_TITRES} », ligne ${numero} : type inconnu (« ${texte(ligne["Type"])} »).`);
    if (!statut) return erreurs.push(`« ${FEUILLE_TITRES} », ligne ${numero} : statut inconnu (« ${texte(ligne["Statut"])} »).`);
    const identifiant = texte(ligne["Identifiant"]).trim();
    if (titres.has(identifiant)) return erreurs.push(`« ${FEUILLE_TITRES} », ligne ${numero} : titre en double (${identifiant}).`);
    titres.set(identifiant, {
      identifiant, id,
      titre: texte(ligne["Titre"]).trim(),
      annee: nombre(ligne["Année"]),
      type, statut,
      vu_avant: ["oui", "true", "1", "vrai"].includes(sansAccent(ligne["Vu avant"])),
      note_serie: nombre(ligne["Note série"]),
      notes: texte(ligne["Notes"]),
      duree_min: nombre(ligne["Durée (min)"]),
    });
  });

  // --- Historique ---
  const visionnages = [];
  const episodesVus = new Set();
  lignesHistorique.forEach((ligne, i) => {
    const numero = i + 2;
    const identifiant = texte(ligne["Identifiant"]).trim();
    if (!identifiant && !texte(ligne["Titre"]).trim()) return; // ligne vide
    const titre = titres.get(identifiant);
    if (!titre) return erreurs.push(`« ${FEUILLE_HISTORIQUE} », ligne ${numero} : ce titre (${identifiant || "sans identifiant"}) n'est pas dans la feuille « ${FEUILLE_TITRES} ».`);
    if (sansAccent(ligne["Date"]) === sansAccent(TEXTE_VU_AVANT)) { titre.vu_avant = true; return; }
    const date = lireDate(ligne["Date"]);
    if (!date) return erreurs.push(`« ${FEUILLE_HISTORIQUE} », ligne ${numero} : date illisible (« ${texte(ligne["Date"])} »).`);
    const episode = nombre(ligne["Épisode"]);
    const saison = episode > 0 ? nombre(ligne["Saison"]) : 0;
    if (episode > 0) {
      const cle = `${identifiant}|${saison}|${episode}`;
      if (episodesVus.has(cle)) return erreurs.push(`« ${FEUILLE_HISTORIQUE} », ligne ${numero} : épisode S${saison}E${episode} en double pour « ${titre.titre} ».`);
      episodesVus.add(cle);
    }
    visionnages.push({ identifiant, date, saison, episode, note: nombre(ligne["Note"]), commentaire: texte(ligne["Commentaire"]) });
  });

  return { titres: [...titres.values()], visionnages, erreurs };
}

// ---------- 2. Aperçu : « X titres, Y visionnages » ----------
const cleVisionnage = (date, saison, episode) => `${date}|${saison}|${episode}`;

async function apercuImport(donnees) {
  const [titresExistants, visionnagesExistants] = await Promise.all([pbListe("titres"), pbListe("visionnages")]);
  const existants = new Map(titresExistants.map((t) => [identifiantTitre(t), t]));
  const nouveauxTitres = donnees.titres.filter((t) => !existants.has(t.identifiant)).length;

  // Visionnages déjà présents (même titre, même date, même épisode), comptés un par un
  const dejaLa = new Map();
  for (const v of visionnagesExistants) {
    const t = titresExistants.find((x) => x.id === v.titre);
    if (!t) continue;
    const cle = `${identifiantTitre(t)}|${cleVisionnage(String(v.date).slice(0, 10), v.saison, v.episode)}`;
    dejaLa.set(cle, (dejaLa.get(cle) || 0) + 1);
  }
  let nouveauxVisionnages = 0;
  for (const v of donnees.visionnages) {
    const cle = `${v.identifiant}|${cleVisionnage(v.date, v.saison, v.episode)}`;
    if (dejaLa.get(cle) > 0) dejaLa.set(cle, dejaLa.get(cle) - 1);
    else nouveauxVisionnages++;
  }
  return {
    titres: donnees.titres.length,
    visionnages: donnees.visionnages.length,
    nouveauxTitres,
    nouveauxVisionnages,
    titresActuels: titresExistants.length,
    visionnagesActuels: visionnagesExistants.length,
  };
}

// ---------- 3. Application ----------
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

function champsTitre(t) {
  const champs = {
    source: t.id.source, type: t.type, titre: t.titre, annee: t.annee, statut: t.statut,
    vu_avant: t.vu_avant, note_serie: t.note_serie, notes: t.notes, duree_min: t.duree_min,
  };
  if (t.id.source === "tmdb") {
    champs.id_source = t.id.idSource;
    champs.format_source = t.id.format;
  } else if (/^[a-z0-9]{15}$/.test(t.id.idInterne)) {
    champs.id = t.id.idInterne; // on garde l'identifiant d'origine : un import « fusionner » le retrouvera
  }
  return champs;
}

// mode : "fusionner" ou "remplacer". Renvoie un petit bilan.
async function appliquerImport(donnees, mode, progression) {
  const bilan = { titresAjoutes: 0, visionnagesAjoutes: 0, titresSupprimes: 0 };
  let existants = await pbListe("titres");

  if (mode === "remplacer") {
    await enParallele(existants, (t) => pbSupprimer("titres", t.id), (f, n) => progression("Suppression de l'ancienne bibliothèque", f, n));
    bilan.titresSupprimes = existants.length;
    existants = [];
  }

  // Identifiant du titre dans la base : celui qui existe déjà, ou celui qu'on crée
  const idBase = new Map(existants.map((t) => [identifiantTitre(t), t.id]));
  const nouveaux = donnees.titres.filter((t) => !idBase.has(t.identifiant));
  await enParallele(nouveaux, async (t) => {
    const cree = await pbCreer("titres", champsTitre(t));
    idBase.set(t.identifiant, cree.id);
  }, (f, n) => progression("Création des titres", f, n));
  bilan.titresAjoutes = nouveaux.length;

  // Visionnages : on saute ceux qui existent déjà (pas de doublons)
  const dejaLa = new Map();
  if (mode === "fusionner") {
    const parId = new Map(existants.map((t) => [t.id, identifiantTitre(t)]));
    for (const v of await pbListe("visionnages")) {
      const cle = `${parId.get(v.titre)}|${cleVisionnage(String(v.date).slice(0, 10), v.saison, v.episode)}`;
      dejaLa.set(cle, (dejaLa.get(cle) || 0) + 1);
    }
  }
  const aCreer = [];
  for (const v of donnees.visionnages) {
    const cle = `${v.identifiant}|${cleVisionnage(v.date, v.saison, v.episode)}`;
    if (dejaLa.get(cle) > 0) dejaLa.set(cle, dejaLa.get(cle) - 1);
    else aCreer.push(v);
  }
  await enParallele(aCreer, (v) => pbCreer("visionnages", {
    titre: idBase.get(v.identifiant), date: `${v.date} 00:00:00.000Z`,
    saison: v.saison, episode: v.episode, note: v.note, commentaire: v.commentaire,
  }), (f, n) => progression("Création des visionnages", f, n));
  bilan.visionnagesAjoutes = aCreer.length;
  return bilan;
}
