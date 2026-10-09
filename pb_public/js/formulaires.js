// Fenêtres et morceaux de formulaire partagés (catalogue, fiche titre...).
// (Dépend de commun.js : el, dateDuJour)

// ---------- Fenêtre générique ----------
// "remplir" ajoute les champs dans le formulaire ; "valider" reçoit le FormData et
// fait le travail (si elle lève une erreur, elle s'affiche dans la fenêtre).
function ouvrirDialogue({ titre, remplir, libelleValider, valider, danger }) {
  const message = el("p", { class: "erreur-dialogue", hidden: true });
  const boutonValider = el("button", { type: "submit", class: danger ? "danger" : "principal" }, libelleValider);
  const boutonAnnuler = el("button", { type: "button" }, "Annuler");
  const formulaire = el("form", { method: "dialog" });
  remplir(formulaire);
  formulaire.append(message, el("div", { class: "boutons-dialogue" }, boutonAnnuler, boutonValider));
  const fenetre = el("dialog", {}, el("h2", {}, titre), formulaire);

  boutonAnnuler.addEventListener("click", () => fenetre.close());
  fenetre.addEventListener("close", () => fenetre.remove());
  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    boutonValider.disabled = true;
    message.hidden = true;
    try {
      await valider(new FormData(formulaire));
      fenetre.close();
      fenetre.remove();
    } catch (erreur) {
      message.textContent = erreur.message;
      message.hidden = false;
      boutonValider.disabled = false;
    }
  });
  document.body.append(fenetre);
  fenetre.showModal();
}

// ---------- Morceaux de formulaire ----------
function champsRadio(nom, options, valeurParDefaut, legende) {
  return el("fieldset", {},
    el("legend", {}, legende),
    el("div", { class: "choix" }, options.map(([valeur, libelle]) =>
      el("label", {}, el("input", { type: "radio", name: nom, value: valeur, checked: valeur === valeurParDefaut }), libelle))));
}

// Note sur 10 par étoiles, demi-étoiles comprises (remplace la saisie du nombre au clavier).
//  - clic sur la moitié gauche d'une étoile = demi-étoile, sur la moitié droite = étoile entière ;
//  - re-cliquer sur la note actuelle (ou « Effacer ») = pas de note ;
//  - au clavier : flèches ±0,5 · Début/Fin · Suppr. pour effacer.
// L'élément renvoyé contient un champ caché (name = "nom") lu par le formulaire, envoie un
// évènement "change" quand la note change, et se désactive avec `element.disabled = true`.
// Rappel : 0 = « pas de note ».
function champNoteEtoiles(nom, valeur) {
  let note = Number(valeur) || 0;
  const cache = el("input", { type: "hidden", name: nom, value: String(note) });
  const texte = el("span", { class: "note-valeur" });
  const effacer = el("button", { type: "button", class: "lien" }, "Effacer");
  const remplissages = [];
  const conteneur = el("div", {
    class: "note-etoiles", role: "slider", tabindex: "0", "aria-label": "Note sur 10",
    "aria-valuemin": "0", "aria-valuemax": "10", "aria-valuestep": "0.5",
  });

  for (let i = 0; i < 10; i++) {
    const pleine = icone("star");
    pleine.classList.add("icone-pleine");
    const remplissage = el("span", { class: "etoile-remplie" }, pleine);
    remplissages.push(remplissage);
    conteneur.append(el("span", { class: "etoile" }, icone("star"), remplissage));
  }

  const dessiner = (valeurAffichee) => {
    remplissages.forEach((r, i) => { r.style.width = `${Math.max(0, Math.min(1, valeurAffichee - i)) * 100}%`; });
    texte.textContent = valeurAffichee ? `${valeurAffichee}/10` : "pas de note";
    conteneur.setAttribute("aria-valuenow", String(note));
    conteneur.setAttribute("aria-valuetext", note ? `${note} sur 10` : "pas de note");
    effacer.hidden = !note;
  };
  const changer = (nouvelle) => {
    note = Math.max(0, Math.min(10, nouvelle));
    cache.value = String(note);
    dessiner(note);
    conteneur.dispatchEvent(new Event("change", { bubbles: true }));
  };
  // Valeur visée par la souris : moitié gauche d'une étoile = demi-étoile
  const valeurSous = (evenement) => {
    const etoile = evenement.target.closest(".etoile");
    if (!etoile) return null;
    const rang = [...conteneur.children].indexOf(etoile);
    const cadre = etoile.getBoundingClientRect();
    return rang + (evenement.clientX - cadre.left < cadre.width / 2 ? 0.5 : 1);
  };

  const enveloppe = el("div", { class: "champ-note" }, conteneur, el("span", { class: "note-infos" }, texte, effacer), cache);
  conteneur.addEventListener("mousemove", (e) => { const v = valeurSous(e); if (v !== null && !enveloppe.disabled) dessiner(v); });
  conteneur.addEventListener("mouseleave", () => dessiner(note));
  conteneur.addEventListener("click", (e) => {
    const v = valeurSous(e);
    if (v !== null && !enveloppe.disabled) changer(v === note ? 0 : v);
  });
  conteneur.addEventListener("keydown", (e) => {
    if (enveloppe.disabled) return;
    const actions = { ArrowRight: note + 0.5, ArrowUp: note + 0.5, ArrowLeft: note - 0.5, ArrowDown: note - 0.5, Home: 0, End: 10, Delete: 0, Backspace: 0 };
    if (e.key in actions) { e.preventDefault(); changer(actions[e.key]); }
  });
  effacer.addEventListener("click", () => changer(0));

  // `enveloppe.disabled = true` : grisé, non modifiable, et absent du formulaire envoyé
  Object.defineProperty(enveloppe, "disabled", {
    get: () => cache.disabled,
    set: (desactive) => {
      cache.disabled = desactive;
      enveloppe.classList.toggle("desactive", desactive);
      conteneur.tabIndex = desactive ? -1 : 0;
      conteneur.setAttribute("aria-disabled", String(desactive));
    },
  });
  dessiner(note);
  return enveloppe;
}

// Les champs du bouton « Vu » (cahier des charges, section 6) :
// date (aujourd'hui par défaut), note /10, commentaire, case « Vu avant, date inconnue ».
// "valeurs" sert à pré-remplir (modification d'un visionnage) ; "avecVuAvant" = false
// cache la case « Vu avant » (qui n'a pas de sens pour un visionnage déjà daté).
function champsVu(valeurs, avecVuAvant) {
  valeurs = valeurs || {};
  const date = el("input", { type: "date", name: "date", value: valeurs.date || dateDuJour() });
  const note = champNoteEtoiles("note", valeurs.note);
  const commentaire = el("textarea", { name: "commentaire", rows: "3", placeholder: "facultatif" }, valeurs.commentaire || "");
  const lignes = [
    el("div", { class: "champ" }, el("label", {}, "Date du visionnage"), date),
    el("div", { class: "champ" }, el("label", {}, "Note /10"), note),
    el("div", { class: "champ" }, el("label", {}, "Commentaire"), commentaire),
  ];
  if (avecVuAvant !== false) {
    const vuAvant = el("input", {
      type: "checkbox", name: "vu_avant",
      onchange: () => {
        // « Vu avant » : pas de date, de note ni de commentaire
        for (const champ of [date, note, commentaire]) champ.disabled = vuAvant.checked;
      },
    });
    lignes.push(el("div", { class: "champ" }, el("label", { class: "choix" }, vuAvant, "Vu avant, date inconnue")));
  }
  return el("div", {}, lignes);
}

// Construit les champs d'un visionnage de film à partir du formulaire.
// "idTitre" est omis (null) quand on modifie un visionnage existant.
// Rappel : PocketBase range « vide » comme 0 (note 0 = pas de note ; saison/épisode 0 = film).
// Les dates sont stockées à minuit UTC et toujours affichées en UTC (pas de décalage d'heure).
function visionnageDepuisFormulaire(idTitre, donnees) {
  const ligne = {
    date: `${donnees.get("date") || dateDuJour()} 00:00:00.000Z`,
    saison: 0,
    episode: 0,
    note: Number(donnees.get("note")) || 0,
    commentaire: donnees.get("commentaire") || "",
  };
  if (idTitre) ligne.titre = idTitre;
  return ligne;
}
