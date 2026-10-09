// Partie « série / animé » de la fiche : saisons dépliables, épisodes à cocher,
// « toute la saison », progression, statuts automatiques, note de la série.
// (Dépend de commun.js, formulaires.js, serie.js et des variables de fiche.js : titre, visionnages, modifierTitre)
//
// Rappel des données : un épisode coché = une ligne « visionnages » (saison, episode, date).
// La saison 0 = les épisodes spéciaux : on peut les cocher, mais ils ne comptent pas
// dans la progression ni pour savoir si la série est terminée.

let saisonsSerie = null;           // [{numero, nom, nb_episodes, episodes: [...]}]
const saisonsOuvertes = new Set(); // numéros des saisons dépliées
// (La logique de calcul — cleEpisode, estDiffuse, calculerProgression... — est dans serie.js)
// Passage affiché (1 = première fois, 2 = premier revisionnage...). null = le plus récent.
// Un nouveau passage vide n'existe qu'à l'écran tant qu'aucun épisode n'y est coché.
let passageAffiche = null;
const passageCourant = () => passageAffiche || passageActuelDe(visionnages);
const episodesVus = () => episodesVusDe(visionnages, passageCourant());
const progressionActuelle = () => calculerProgression(saisonsSerie, visionnages, passageCourant());

// ---------- Statuts automatiques (cahier des charges, section 6) ----------
async function appliquerStatutAuto(coche) {
  const p = progressionActuelle();
  let statut = titre.statut;
  if (coche) {
    // Cocher un épisode : en cours, ou terminé si tous les épisodes diffusés sont vus
    statut = p.complet ? "termine" : "en_cours";
  } else if (p.total === 0) {
    if (passageCourant() > 1) {
      // Revisionnage vidé : on retombe sur l'état du passage précédent
      statut = calculerProgression(saisonsSerie, visionnages, passageCourant() - 1).complet ? "termine" : "en_cours";
    } else if (["en_cours", "termine"].includes(statut) && !titre.vu_avant) statut = "a_voir";
  } else if (statut === "termine" && !p.complet) {
    statut = "en_cours";
  }
  if (statut !== titre.statut) {
    await modifierTitre({ statut });
    const select = document.getElementById("statut");
    if (select) select.value = titre.statut;
  }
}

// ---------- Actions ----------
function dateDeCochage() {
  const champ = document.getElementById("date-cochage");
  return (champ && champ.value) || dateDuJour();
}

// Case « Vu avant, date inconnue » : les épisodes cochés sont enregistrés sans date
let cocherSansDate = false;

async function cocherEpisode(saison, episode) {
  const ligne = await cocherEpisodeSerie(titre.id, saison, episode, dateDeCochage(), cocherSansDate, passageCourant());
  visionnages.push(ligne);
}

async function decocherEpisode(saison, episode) {
  const ligne = episodesVus().get(cleEpisode(saison, episode));
  if (!ligne) return;
  await pbSupprimer("visionnages", ligne.id);
  visionnages = visionnages.filter((v) => v.id !== ligne.id);
}

// Coche ou décoche un seul épisode, puis met à jour le statut et l'affichage.
async function basculerEpisode(saison, episode, coche) {
  try {
    if (coche) {
      await cocherEpisode(saison, episode);
      if (optionPrecedents) {
        // On coche aussi tout ce qui précède (même date), sauf ce qui est déjà coché
        const dejaVus = episodesVus();
        const manquants = episodesAvant(saisonsSerie, saison, episode).filter((x) => !dejaVus.has(cleEpisode(x.saison, x.episode)));
        await enParallele(manquants, (x) => cocherEpisode(x.saison, x.episode), () => {});
        if (manquants.length) toast(`${manquants.length} épisode${manquants.length > 1 ? "s" : ""} précédent${manquants.length > 1 ? "s" : ""} coché${manquants.length > 1 ? "s" : ""} aussi.`);
      }
    } else {
      await decocherEpisode(saison, episode);
    }
    await appliquerStatutAuto(coche);
  } catch (erreur) {
    toast(erreur.message, true);
  }
  dessinerSerie();
}

// « Toute la saison » : une ligne par épisode diffusé et pas encore coché, avec la même date.
async function cocherSaison(saison) {
  const vus = episodesVus();
  try {
    for (const episode of saison.episodes) {
      if (estDiffuse(episode) && !vus.has(cleEpisode(saison.numero, episode.numero))) {
        await cocherEpisode(saison.numero, episode.numero);
      }
    }
  } catch (erreur) {
    toast(erreur.message, true);
  }
  try { await appliquerStatutAuto(true); } catch (erreur) { toast(erreur.message, true); }
  dessinerSerie();
}

function confirmerDecocherSaison(saison) {
  ouvrirDialogue({
    titre: `Décocher « ${saison.nom} » ?`,
    libelleValider: "Décocher la saison",
    danger: true,
    remplir: (formulaire) => formulaire.append(el("p", {}, "Tous les épisodes cochés de cette saison seront décochés (leurs dates sont perdues).")),
    valider: async () => {
      for (const episode of saison.episodes) await decocherEpisode(saison.numero, episode.numero);
      await appliquerStatutAuto(false);
      dessinerSerie();
    },
  });
}

function ouvrirDateEpisode(saison, episode) {
  const ligne = episodesVus().get(cleEpisode(saison, episode));
  ouvrirDialogue({
    titre: `Date de visionnage (S${saison}E${episode})`,
    libelleValider: "Enregistrer",
    remplir: (formulaire) => formulaire.append(el("div", { class: "champ" },
      el("label", {}, "Date"), el("input", { type: "date", name: "date", required: true, value: ligne.avant ? dateDuJour() : String(ligne.date).slice(0, 10) }))),
    valider: async (donnees) => {
      // Donner une date à un épisode « vu avant » le fait sortir de « vu avant »
      const misAJour = await pbModifier("visionnages", ligne.id, { date: `${donnees.get("date")} 00:00:00.000Z`, avant: false });
      visionnages = visionnages.map((v) => (v.id === ligne.id ? misAJour : v));
      dessinerSerie();
    },
  });
}

// ---------- Revisionnage ----------
// « Revoir la série » ouvre un nouveau passage : tous les épisodes redeviennent à cocher,
// et les passages précédents restent consultables dans leurs onglets.
function confirmerRevisionnage() {
  const prochain = passageActuelDe(visionnages) + 1;
  ouvrirDialogue({
    titre: `Revoir « ${titre.titre} » ?`,
    libelleValider: "Commencer le revisionnage",
    remplir: (formulaire) => formulaire.append(el("p", {},
      `Un passage n°${prochain} commence : tu recoches les épisodes au fur et à mesure. Tes visionnages précédents sont conservés.`)),
    valider: async () => {
      passageAffiche = prochain;
      if (titre.statut === "termine") { await modifierTitre({ statut: "en_cours" }); const select = document.getElementById("statut"); if (select) select.value = titre.statut; }
      dessinerSerie();
    },
  });
}

// Onglets « Première fois / Revisionnage n°2... » (seulement s'il y a plus d'un passage)
function ongletsPassages() {
  const dernier = Math.max(passageActuelDe(visionnages), passageCourant());
  if (dernier < 2) return null;
  const nomDe = (n) => (n === 1 ? "Première fois" : `Revisionnage n°${n - 1}`);
  return el("nav", { class: "categories onglets-passages", "aria-label": "Passages" },
    Array.from({ length: dernier }, (_, i) => i + 1).map((n) => el("a", {
      href: "#", class: `pastille-categorie${n === passageCourant() ? " active" : ""}`, "aria-current": n === passageCourant() ? "true" : null,
      onclick: (e) => { e.preventDefault(); passageAffiche = n; dessinerSerie(); },
    }, nomDe(n))));
}

// ---------- Note de la série ----------
function blocNoteSerie() {
  // La note s'enregistre toute seule dès qu'on change les étoiles
  const etoiles = champNoteEtoiles("note_serie", titre.note_serie);
  etoiles.addEventListener("change", async () => {
    try { await modifierTitre({ note_serie: Number(etoiles.querySelector("input").value) || 0 }, "Note enregistrée."); }
    catch (erreur) { toast(erreur.message, true); }
  });
  return el("div", { class: "note-serie" }, el("span", { class: "etiquette" }, "Ma note de la série"), etoiles);
}

// ---------- Affichage ----------
function sectionSerie() {
  const section = el("section", { class: "carte", id: "section-serie" }, el("h2", {}, "Épisodes"));
  if (titre.source !== "tmdb") {
    section.append(
      el("p", { class: "discret" }, "Titre ajouté manuellement : pas de liste d'épisodes. Utilise le statut et ta note."),
      blocNoteSerie());
    return section;
  }
  section.append(el("p", { class: "discret", id: "chargement-episodes" }, "Chargement des épisodes…"));
  chargerEpisodes();
  return section;
}

async function chargerEpisodes() {
  try {
    const toutes = await chargerSaisons(titre.id_source);
    // Les « épisodes spéciaux » (saison 0 : making-of, résumés, documentaires…) passent en dernier
    saisonsSerie = [...toutes.filter((s) => s.numero > 0), ...toutes.filter((s) => s.numero === 0)];
  } catch (erreur) {
    const bloc = document.getElementById("chargement-episodes");
    if (bloc) { bloc.className = "ko"; bloc.textContent = `Épisodes indisponibles : ${erreur.message}`; }
    return;
  }

  // Une nouvelle saison (ou un nouvel épisode) est sortie : la série terminée repasse « en cours »
  const p = progressionActuelle();
  if (titre.statut === "termine" && visionnages.length && !p.complet) {
    try {
      await appliquerStatutAuto(false);
      toast("De nouveaux épisodes sont sortis : la série repasse « en cours ».");
    } catch (erreur) { toast(erreur.message, true); }
  }
  // On déplie la saison du prochain épisode à voir (sinon la première)
  const premiere = saisonsSerie.find((s) => s.numero > 0);
  saisonsOuvertes.add(p.prochain ? p.prochain.saison : premiere ? premiere.numero : 0);
  dessinerSerie();
}

function dessinerSerie() {
  const section = document.getElementById("section-serie");
  if (!section || !saisonsSerie) return;
  const p = progressionActuelle();

  const resume = [];
  if (p.dernier) resume.push(`Progression : S${p.dernier.saison}E${p.dernier.episode}`);
  resume.push(`${p.diffusesVus}/${p.diffuses} épisodes diffusés vus`);
  if (titre.vu_avant && passageCourant() === 1) resume.push("vue avant la création du site");
  if (passageCourant() > 1) resume.push(`revisionnage n°${passageCourant() - 1}`);

  const boutonSuivant = el("button", { type: "button", class: "principal", disabled: !p.prochain, onclick: async () => {
    if (p.prochain) await basculerEpisode(p.prochain.saison, p.prochain.episode, true);
  } }, p.prochain ? `Cocher le suivant (S${p.prochain.saison}E${p.prochain.episode})` : "Tout est vu");

  const champDate = el("input", { type: "date", id: "date-cochage", value: (document.getElementById("date-cochage") || {}).value || dateDuJour(), disabled: cocherSansDate });
  const caseAvant = el("input", { type: "checkbox", checked: cocherSansDate });
  caseAvant.addEventListener("change", () => { cocherSansDate = caseAvant.checked; champDate.disabled = cocherSansDate; });
  const barre = el("div", { class: "barre-serie" },
    el("label", { class: "discret" }, "Date appliquée quand je coche : ", champDate),
    el("label", { class: "option-precedents", title: "Les épisodes cochés sont enregistrés sans date : tu les avais vus avant, sans savoir quand" },
      caseAvant, "Vu avant, date inconnue"),
    creerOptionPrecedents(),
    boutonSuivant);

  // « Revoir la série » : possible quand le passage affiché est le dernier et qu'il est entamé (ou que la série est « vue avant »)
  const peutRevoir = passageCourant() === passageActuelDe(visionnages) && (p.total > 0 || titre.vu_avant);
  const boutonRevoir = peutRevoir ? el("button", { type: "button", class: "contour", onclick: confirmerRevisionnage }, icone("clock"), "Revoir la série") : null;

  section.replaceChildren(
    el("h2", {}, "Épisodes"),
    ongletsPassages(),
    el("p", { class: "progression" }, resume.join(" · ")),
    barre,
    boutonRevoir,
    blocNoteSerie(),
    ...saisonsSerie.map((saison) => dessinerSaison(saison, p.vus)));
}

function dessinerSaison(saison, vus) {
  const diffuses = saison.episodes.filter(estDiffuse);
  const vusSaison = saison.episodes.filter((e) => vus.has(cleEpisode(saison.numero, e.numero))).length;
  const aVenir = saison.episodes.length - diffuses.length;
  const toutCoche = diffuses.length > 0 && diffuses.every((e) => vus.has(cleEpisode(saison.numero, e.numero)));

  const liste = el("ul", { class: "liste-episodes" }, saison.episodes.map((episode) => {
    const ligne = vus.get(cleEpisode(saison.numero, episode.numero));
    const boite = el("input", { type: "checkbox", checked: !!ligne, disabled: !ligne && !estDiffuse(episode) });
    boite.addEventListener("change", () => {
      boite.disabled = true;
      basculerEpisode(saison.numero, episode.numero, boite.checked);
    });
    const infos = [];
    if (!estDiffuse(episode)) infos.push(episode.date_diffusion ? `à venir le ${formatDate(episode.date_diffusion)}` : "date inconnue");
    else if (episode.date_diffusion) infos.push(`diffusé le ${formatDate(episode.date_diffusion)}`);
    if (episode.duree_min) infos.push(`${episode.duree_min} min`);
    return el("li", { class: ligne ? "episode-vu" : "" },
      el("label", { title: episode.synopsis || "" }, boite, ` ${episode.numero}. ${episode.nom}`),
      el("span", { class: "discret" }, infos.join(" · ")),
      ligne ? el("span", { class: "vu-le" },
        ligne.avant ? "vu avant " : `vu le ${formatDate(ligne.date)} `,
        el("button", { type: "button", class: "lien", onclick: () => ouvrirDateEpisode(saison.numero, episode.numero) }, "modifier")) : null);
  }));

  const boutonSaison = toutCoche
    ? el("button", { type: "button", onclick: () => confirmerDecocherSaison(saison) }, "Décocher la saison")
    : el("button", { type: "button", disabled: !diffuses.length, onclick: () => cocherSaison(saison) }, "Cocher toute la saison");

  const bonus = saison.numero === 0; // la « saison 0 » de TMDB : vidéos annexes, pas de vrais épisodes
  const nomSaison = bonus ? "Bonus : coulisses, résumés, documentaires" : saison.nom;
  const resumeSaison = `${nomSaison} — ${vusSaison}/${saison.episodes.length}${aVenir ? ` (${aVenir} à venir)` : ""}`;
  const detail = el("details", { class: "saison", open: saisonsOuvertes.has(saison.numero) },
    el("summary", {}, resumeSaison),
    bonus ? el("p", { class: "discret" }, "Vidéos annexes de la série (making-of, résumés, interviews, documentaires…). Elles ne comptent pas dans ta progression.") : null,
    el("div", { class: "actions-saison" }, boutonSaison),
    liste);
  detail.addEventListener("toggle", () => {
    if (detail.open) saisonsOuvertes.add(saison.numero);
    else saisonsOuvertes.delete(saison.numero);
  });
  return detail;
}
