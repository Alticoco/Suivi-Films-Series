// Page Journal : tous mes visionnages, du plus récent au plus ancien, regroupés par mois.
// Les épisodes d'une même série cochés le même jour sont regroupés sur une ligne
// (ex. « S1E1–E5 ») pour que « toute la saison » ne remplisse pas la page.
// (Dépend de commun.js)

// Les dates sont stockées à minuit UTC : on les affiche toujours en UTC (pas de décalage).
const formatMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const formatJour = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });
const dateUtc = (jour) => new Date(`${jour}T00:00:00Z`);

// [[1,1],[1,2],[1,3],[2,1]] → "S1E1–E3, S2E1" (les épisodes consécutifs sont regroupés)
function resumerEpisodes(episodes) {
  const tries = [...episodes].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const morceaux = [];
  let i = 0;
  while (i < tries.length) {
    const [saison, debut] = tries[i];
    let fin = debut;
    while (i + 1 < tries.length && tries[i + 1][0] === saison && tries[i + 1][1] === fin + 1) { fin = tries[++i][1]; }
    const prefixe = saison === 0 ? "Spécial " : `S${saison}`;
    morceaux.push(debut === fin ? `${prefixe}E${debut}` : `${prefixe}E${debut}–E${fin}`);
    i++;
  }
  return morceaux.join(", ");
}

// Transforme les visionnages en « entrées » : un film = une entrée,
// des épisodes de la même série le même jour = une entrée.
function construireEntrees(titres, visionnages) {
  const parId = new Map(titres.map((t) => [t.id, t]));
  const entrees = [];
  const regroupes = new Map(); // "jour|titre" → entrée d'épisodes
  for (const v of visionnages) {
    const titre = parId.get(v.titre);
    if (!titre) continue;
    const jour = String(v.date).slice(0, 10);
    if (v.episode > 0) {
      const cle = `${jour}|${titre.id}`;
      if (!regroupes.has(cle)) {
        const entree = { jour, cree: v.created, titre, episodes: [], note: 0, commentaire: "" };
        regroupes.set(cle, entree);
        entrees.push(entree);
      }
      const entree = regroupes.get(cle);
      entree.episodes.push([v.saison, v.episode]);
      if (v.created > entree.cree) entree.cree = v.created;
    } else {
      entrees.push({ jour, cree: v.created, titre, episodes: null, note: v.note, commentaire: v.commentaire });
    }
  }
  // Plus récent d'abord (à date égale : le dernier créé d'abord)
  return entrees.sort((a, b) => b.jour.localeCompare(a.jour) || String(b.cree).localeCompare(String(a.cree)));
}

function creerLigne(entree, resumes) {
  const t = entree.titre;
  const affiche = t.source === "tmdb" ? (resumes[`${t.format_source}:${t.id_source}`] || {}).affiche : null;
  const adresse = urlImageTitre(t, affiche, "w92");
  const vignette = adresse
    ? el("img", { class: "vignette", src: adresse, alt: "", loading: "lazy" })
    : el("div", { class: "vignette vignette-vide" }, "?");
  let detail;
  if (entree.episodes) {
    const n = entree.episodes.length;
    detail = `${resumerEpisodes(entree.episodes)} · ${n} épisode${n > 1 ? "s" : ""}`;
  } else {
    detail = LIBELLES_TYPE[t.type];
  }
  return el("li", { class: "ligne-journal" },
    el("span", { class: "jour" }, formatJour.format(dateUtc(entree.jour))),
    vignette,
    el("div", { class: "journal-contenu" },
      el("a", { href: `fiche.html?id=${t.id}` }, el("strong", {}, t.titre)),
      el("p", { class: "discret" }, detail, entree.note ? el("span", { class: "ma-note" }, ` · ★ ${entree.note}/10`) : null),
      entree.commentaire ? el("p", { class: "commentaire" }, entree.commentaire) : null));
}

async function demarrer() {
  const message = document.getElementById("message");
  const zone = document.getElementById("journal");
  try {
    const [titres, visionnages, resumes] = await Promise.all([
      pbListe("titres"), pbListe("visionnages"), source("resumes").catch(() => ({})),
    ]);
    const entrees = construireEntrees(titres, visionnages);
    document.getElementById("compteur").textContent = `${visionnages.length} visionnage(s)`;
    if (!entrees.length) {
      message.replaceChildren("Aucun visionnage pour l'instant. Marque un film ou un épisode comme vu pour le retrouver ici.");
      return;
    }
    message.hidden = true;

    // Groupes par mois (les entrées sont déjà triées : un nouveau mois = un nouveau groupe)
    let moisCourant = "";
    let liste = null;
    for (const entree of entrees) {
      const mois = entree.jour.slice(0, 7);
      if (mois !== moisCourant) {
        moisCourant = mois;
        const nombre = entrees.filter((e) => e.jour.slice(0, 7) === mois).length;
        liste = el("ul", { class: "liste-journal" });
        zone.append(el("section", { class: "mois" },
          el("h2", {}, formatMois.format(dateUtc(`${mois}-01`)), el("span", { class: "discret" }, ` · ${nombre} entrée${nombre > 1 ? "s" : ""}`)),
          liste));
      }
      liste.append(creerLigne(entree, resumes));
    }
  } catch (erreur) {
    message.className = "ko";
    message.textContent = erreur.message;
  }
}

demarrer();
