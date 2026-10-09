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

// Les champs du bouton « Vu » (cahier des charges, section 6) :
// date (aujourd'hui par défaut), note /10, commentaire, case « Vu avant, date inconnue ».
// "valeurs" sert à pré-remplir (modification d'un visionnage) ; "avecVuAvant" = false
// cache la case « Vu avant » (qui n'a pas de sens pour un visionnage déjà daté).
function champsVu(valeurs, avecVuAvant) {
  valeurs = valeurs || {};
  const date = el("input", { type: "date", name: "date", value: valeurs.date || dateDuJour() });
  const note = el("input", {
    type: "number", name: "note", min: "0", max: "10", step: "0.5", placeholder: "facultative",
    value: valeurs.note ? String(valeurs.note) : null,
  });
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
