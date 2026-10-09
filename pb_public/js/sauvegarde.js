// Page Sauvegarde : export, import, vider le cache TMDB.
// (Dépend de commun.js, formulaires.js, export.js, import.js)

const boutonExport = document.getElementById("bouton-export");
const zoneImport = document.getElementById("zone-import");
let donneesImport = null; // contenu vérifié du fichier choisi

// ---------- Export ----------
async function afficherDernierExport() {
  const zone = document.getElementById("dernier-export");
  try {
    const date = await dateDernierExport();
    if (!date) { zone.textContent = "Aucun export n'a encore été fait."; return; }
    const jours = joursDepuis(date);
    zone.textContent = `Dernier export : ${formatDate(date)} (${jours <= 0 ? "aujourd'hui" : `il y a ${jours} jour${jours > 1 ? "s" : ""}`}).`;
  } catch (erreur) {
    zone.textContent = erreur.message;
  }
}

boutonExport.addEventListener("click", async () => {
  boutonExport.disabled = true;
  try {
    const bilan = await exporterMaintenant();
    toast(`${bilan.nomFichier} : ${bilan.titres} titre(s), ${bilan.visionnages} visionnage(s) exportés.`);
    afficherDernierExport();
  } catch (erreur) {
    toast(erreur.message, true);
  }
  boutonExport.disabled = false;
});

// ---------- Import ----------
document.getElementById("fichier-import").addEventListener("change", async (evenement) => {
  const fichier = evenement.target.files[0];
  donneesImport = null;
  zoneImport.hidden = true;
  if (!fichier) return;

  const apercu = document.getElementById("apercu");
  const erreurs = document.getElementById("erreurs-import");
  erreurs.replaceChildren();
  zoneImport.hidden = false;
  apercu.textContent = "Lecture du fichier…";
  document.getElementById("choix-import").hidden = true;
  try {
    const donnees = await lireFichierImport(fichier);
    const resume = await apercuImport(donnees);
    if (donnees.erreurs.length) {
      apercu.textContent = `Le fichier contient ${donnees.erreurs.length} problème(s). Corrige-le (ou refais un export) puis réessaie : rien n'a été modifié.`;
      erreurs.append(...donnees.erreurs.slice(0, 20).map((e) => el("li", {}, e)));
      if (donnees.erreurs.length > 20) erreurs.append(el("li", {}, `… et ${donnees.erreurs.length - 20} autre(s).`));
      return;
    }
    donneesImport = { donnees, resume };
    apercu.replaceChildren(
      el("strong", {}, `Ce fichier contient ${resume.titres} titre(s) et ${resume.visionnages} visionnage(s).`),
      el("br"),
      `Avec « Fusionner » : ${resume.nouveauxTitres} nouveau(x) titre(s) et ${resume.nouveauxVisionnages} nouveau(x) visionnage(s) seraient ajoutés. `,
      `Ta bibliothèque actuelle contient ${resume.titresActuels} titre(s) et ${resume.visionnagesActuels} visionnage(s).`);
    document.getElementById("choix-import").hidden = false;
  } catch (erreur) {
    apercu.className = "ko";
    apercu.textContent = erreur.message;
  }
});

function lancerImport(mode, sauvegardeAvant) {
  const bouton = document.getElementById("bouton-import");
  const progression = document.getElementById("progression");
  return (async () => {
    bouton.disabled = true;
    try {
      if (sauvegardeAvant) {
        progression.textContent = "Téléchargement d'une sauvegarde de sécurité…";
        await exporterMaintenant(false);
      }
      const bilan = await appliquerImport(donneesImport.donnees, mode,
        (etape, faits, total) => { progression.textContent = `${etape} : ${faits}/${total}`; });
      progression.textContent = "";
      toast(`Import terminé : ${bilan.titresAjoutes} titre(s) et ${bilan.visionnagesAjoutes} visionnage(s) ajoutés.`);
      document.getElementById("fichier-import").value = "";
      zoneImport.hidden = true;
      donneesImport = null;
    } catch (erreur) {
      progression.textContent = "";
      toast(`L'import s'est arrêté : ${erreur.message}`, true);
    }
    bouton.disabled = false;
  })();
}

document.getElementById("bouton-import").addEventListener("click", () => {
  if (!donneesImport) return;
  const mode = document.querySelector("input[name=mode]:checked").value;
  if (mode === "fusionner") {
    lancerImport("fusionner", false);
    return;
  }
  // « Remplacer tout » efface ma bibliothèque : confirmation obligatoire
  ouvrirDialogue({
    titre: "Remplacer toute ma bibliothèque ?",
    libelleValider: "Remplacer tout",
    danger: true,
    remplir: (formulaire) => formulaire.append(
      el("p", {}, `Tes ${donneesImport.resume.titresActuels} titre(s) et ${donneesImport.resume.visionnagesActuels} visionnage(s) actuels seront supprimés, puis remplacés par le contenu du fichier. Cette action est définitive.`),
      el("label", { class: "choix" },
        el("input", { type: "checkbox", name: "sauvegarde", checked: true }),
        "Télécharger d'abord une sauvegarde de ma bibliothèque actuelle (recommandé)")),
    valider: async (donnees) => { lancerImport("remplacer", donnees.get("sauvegarde") === "on"); },
  });
});

// ---------- Cache TMDB ----------
async function afficherInfoCache() {
  const zone = document.getElementById("info-cache");
  try {
    const info = await requete("/api/source/cache");
    zone.textContent = `${info.lignes} fiche(s) en cache.`;
  } catch (erreur) {
    zone.textContent = erreur.message;
  }
}

document.getElementById("bouton-cache").addEventListener("click", () => {
  ouvrirDialogue({
    titre: "Vider le cache TMDB ?",
    libelleValider: "Vider le cache",
    remplir: (formulaire) => formulaire.append(el("p", {},
      "Les synopsis, durées et listes d'épisodes seront rechargés depuis TMDB au fur et à mesure. Tes titres et tes visionnages ne sont pas touchés.")),
    valider: async () => {
      const resultat = await requete("/api/source/cache", { method: "DELETE" });
      toast(`Cache vidé (${resultat.supprimees} fiche(s)).`);
      afficherInfoCache();
    },
  });
});

afficherDernierExport();
afficherInfoCache();
