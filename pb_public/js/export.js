// Export Excel (.xlsx), lisible par un humain (cahier des charges, section 8).
// Deux feuilles :
//  - « Historique » : une ligne par visionnage
//  - « Mes titres » : une ligne par titre
// La dernière colonne, « Identifiant », est la seule colonne technique : elle sert à l'import.
// (Dépend de commun.js ; la bibliothèque Excel est chargée seulement quand on en a besoin.)

const FEUILLE_HISTORIQUE = "Historique";
const FEUILLE_TITRES = "Mes titres";
const ENTETES_HISTORIQUE = ["Titre", "Année", "Type", "Date", "Saison", "Épisode", "Note", "Commentaire", "Statut actuel", "Passage", "Identifiant"];
const ENTETES_TITRES = ["Titre", "Année", "Type", "Statut", "Vu avant", "Coup de cœur", "Note série", "Notes", "Durée (min)", "Identifiant"];
const TEXTE_VU_AVANT = "Vu avant";

// ---------- Chargement de la bibliothèque Excel (copie locale) ----------
let promesseXlsx = null;
function chargerXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (!promesseXlsx) {
    promesseXlsx = new Promise((resolve, reject) => {
      const script = el("script", { src: "js/vendor/xlsx.full.min.js" });
      script.addEventListener("load", resolve);
      script.addEventListener("error", () => { promesseXlsx = null; reject(new Error("Impossible de charger la bibliothèque Excel.")); });
      document.head.append(script);
    });
  }
  return promesseXlsx;
}

// ---------- Identifiants ----------
// tmdb:serie:1399, tmdb:film:603 ou manuel:<identifiant interne>
function identifiantTitre(titre) {
  return titre.source === "tmdb" ? `tmdb:${titre.format_source}:${titre.id_source}` : `manuel:${titre.id}`;
}

// ---------- Construction des feuilles ----------
const vide = (nombre) => (nombre ? nombre : ""); // PocketBase range « vide » comme 0

function construireFeuilles(titres, visionnages) {
  const parId = new Map(titres.map((t) => [t.id, t]));

  // Historique : visionnages du plus ancien au plus récent, puis les titres « vus avant »
  const lignesVisionnages = visionnages
    .filter((v) => parId.has(v.titre))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created).localeCompare(String(b.created)))
    .map((v) => {
      const t = parId.get(v.titre);
      return [t.titre, vide(t.annee), LIBELLES_TYPE[t.type], v.avant ? TEXTE_VU_AVANT : formatDate(v.date),
        v.episode > 0 ? v.saison : "", v.episode > 0 ? v.episode : "",
        vide(v.note), v.commentaire || "", LIBELLES_STATUT[t.statut], v.passage > 1 ? v.passage : "", identifiantTitre(t)];
    });
  const lignesVuAvant = titres
    .filter((t) => t.vu_avant)
    .map((t) => [t.titre, vide(t.annee), LIBELLES_TYPE[t.type], TEXTE_VU_AVANT, "", "", "", "", LIBELLES_STATUT[t.statut], "", identifiantTitre(t)]);

  const lignesTitres = [...titres]
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"))
    .map((t) => [t.titre, vide(t.annee), LIBELLES_TYPE[t.type], LIBELLES_STATUT[t.statut], t.vu_avant ? "Oui" : "Non", t.coup_de_coeur ? "Oui" : "Non",
      vide(t.note_serie), t.notes || "", vide(t.duree_min), identifiantTitre(t)]);

  return {
    historique: [ENTETES_HISTORIQUE, ...lignesVisionnages, ...lignesVuAvant],
    titres: [ENTETES_TITRES, ...lignesTitres],
  };
}

function feuilleExcel(lignes, largeurs) {
  const feuille = XLSX.utils.aoa_to_sheet(lignes);
  feuille["!cols"] = largeurs.map((wch) => ({ wch }));
  return feuille;
}

// ---------- Date du dernier export (collection « reglages », un seul enregistrement) ----------
async function lireReglages() {
  const liste = await pbListe("reglages");
  return liste[0] || null;
}

async function dateDernierExport() {
  const reglages = await lireReglages();
  return reglages && reglages.dernier_export ? reglages.dernier_export : null;
}

// Nombre de jours depuis une date PocketBase (null si jamais)
function joursDepuis(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(String(date).replace(" ", "T")).getTime()) / 86400000);
}

// ---------- Export ----------
// Crée et télécharge le fichier, puis note la date du dernier export.
// "enregistrerDate" = false pour une sauvegarde de précaution (avant un import « remplacer tout »).
function construireClasseur(titres, visionnages) {
  const feuilles = construireFeuilles(titres, visionnages);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuilleExcel(feuilles.historique, [34, 7, 8, 12, 7, 8, 6, 40, 12, 22]), FEUILLE_HISTORIQUE);
  XLSX.utils.book_append_sheet(classeur, feuilleExcel(feuilles.titres, [34, 7, 8, 12, 9, 12, 10, 40, 11, 22]), FEUILLE_TITRES);
  return classeur;
}

async function exporterMaintenant(enregistrerDate) {
  await chargerXlsx();
  const [titres, visionnages] = await Promise.all([pbListe("titres"), pbListe("visionnages")]);
  const classeur = construireClasseur(titres, visionnages);
  const nomFichier = `suivi-films-series_${dateDuJour()}.xlsx`;
  XLSX.writeFile(classeur, nomFichier);

  if (enregistrerDate !== false) {
    const reglages = await lireReglages();
    if (reglages) {
      await pbModifier("reglages", reglages.id, { dernier_export: new Date().toISOString().replace("T", " ") });
    }
  }
  return { nomFichier, titres: titres.length, visionnages: visionnages.length };
}
