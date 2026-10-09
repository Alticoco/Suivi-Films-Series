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
const episodesVus = () => episodesVusDe(visionnages);
const progressionActuelle = () => calculerProgression(saisonsSerie, visionnages);

// ---------- Statuts automatiques (cahier des charges, section 6) ----------
async function appliquerStatutAuto(coche) {
  const p = progressionActuelle();
  let statut = titre.statut;
  if (coche) {
    // Cocher un épisode : en cours, ou terminé si tous les épisodes diffusés sont vus
    statut = p.complet ? "termine" : "en_cours";
  } else if (p.total === 0) {
    if (["en_cours", "termine"].includes(statut) && !titre.vu_avant) statut = "a_voir";
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

async function cocherEpisode(saison, episode) {
  const ligne = await pbCreer("visionnages", {
    titre: titre.id, date: `${dateDeCochage()} 00:00:00.000Z`, saison, episode,
  });
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
      el("label", {}, "Date"), el("input", { type: "date", name: "date", required: true, value: String(ligne.date).slice(0, 10) }))),
    valider: async (donnees) => {
      const misAJour = await pbModifier("visionnages", ligne.id, { date: `${donnees.get("date")} 00:00:00.000Z` });
      visionnages = visionnages.map((v) => (v.id === ligne.id ? misAJour : v));
      dessinerSerie();
    },
  });
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
  if (titre.vu_avant) resume.push("vue avant la création du site");

  const boutonSuivant = el("button", { type: "button", class: "principal", disabled: !p.prochain, onclick: async () => {
    if (p.prochain) await basculerEpisode(p.prochain.saison, p.prochain.episode, true);
  } }, p.prochain ? `Cocher le suivant (S${p.prochain.saison}E${p.prochain.episode})` : "Tout est vu");

  const barre = el("div", { class: "barre-serie" },
    el("label", { class: "discret" }, "Date appliquée quand je coche : ",
      el("input", { type: "date", id: "date-cochage", value: (document.getElementById("date-cochage") || {}).value || dateDuJour() })),
    creerOptionPrecedents(),
    boutonSuivant);

  section.replaceChildren(
    el("h2", {}, "Épisodes"),
    el("p", { class: "progression" }, resume.join(" · ")),
    barre,
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
        `vu le ${formatDate(ligne.date)} `,
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
