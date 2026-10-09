/// <reference path="../pb_data/types.d.ts" />

// Crée les 4 collections du projet (cahier des charges, section 5).
// PocketBase exécute ce fichier tout seul au démarrage, une seule fois.
//
// Deux mondes séparés :
//  - titres, visionnages, reglages  = MES données (définitives)
//  - cache_source                   = habillage TMDB (jetable)
//
// Règles d'accès : le serveur n'écoute que sur 127.0.0.1 et il n'y a aucun
// compte, donc mes données sont ouvertes ("") au site. Le cache, lui, n'est
// accessible que par le serveur (null = réservé à l'administrateur).
migrate((app) => {
  // ---------- titres ----------
  const titres = new Collection({
    type: "base",
    name: "titres",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { type: "select", name: "source", required: true, maxSelect: 1, values: ["tmdb", "manuel"] },
      { type: "text", name: "id_source" },
      // Pour une source TMDB : un film et une série peuvent avoir le même numéro,
      // on retient donc le "format" côté TMDB (un animé peut être l'un ou l'autre).
      { type: "select", name: "format_source", maxSelect: 1, values: ["film", "serie"] },
      { type: "select", name: "type", required: true, maxSelect: 1, values: ["film", "serie", "anime"] },
      { type: "text", name: "titre", required: true },
      { type: "number", name: "annee", onlyInt: true },
      {
        type: "select", name: "statut", required: true, maxSelect: 1,
        values: ["a_voir", "en_cours", "termine", "en_pause", "abandonne"],
      },
      { type: "bool", name: "vu_avant" },
      { type: "number", name: "note_serie", min: 0, max: 10 },
      { type: "text", name: "notes", max: 20000 },
      { type: "number", name: "duree_min", min: 0 },
      {
        type: "file", name: "image_perso", maxSelect: 1, maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
      { type: "autodate", name: "ajoute_le", onCreate: true },
    ],
    indexes: [
      // Un même titre TMDB ne peut être ajouté qu'une fois (les titres manuels sont exclus)
      "CREATE UNIQUE INDEX idx_titres_source ON titres (source, id_source, format_source) WHERE id_source != ''",
    ],
  });
  app.save(titres);

  // ---------- visionnages ----------
  // Film : une ligne par visionnage (saison = 0 et episode = 0 : "vide").
  // Série : une ligne par épisode coché (episode >= 1 ; la saison 0 = les épisodes spéciaux).
  const visionnages = new Collection({
    type: "base",
    name: "visionnages",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { type: "relation", name: "titre", required: true, maxSelect: 1, collectionId: titres.id, cascadeDelete: true },
      { type: "date", name: "date" },
      { type: "number", name: "saison", onlyInt: true, min: 0 },
      { type: "number", name: "episode", onlyInt: true, min: 0 },
      { type: "number", name: "note", min: 0, max: 10 },
      { type: "text", name: "commentaire", max: 10000 },
    ],
    indexes: [
      "CREATE INDEX idx_visionnages_titre ON visionnages (titre)",
      "CREATE INDEX idx_visionnages_date ON visionnages (date)",
      // V1 : un épisode ne peut être coché qu'une fois
      "CREATE UNIQUE INDEX idx_visionnages_episode ON visionnages (titre, saison, episode) WHERE episode > 0",
    ],
  });
  app.save(visionnages);

  // ---------- cache_source (habillage TMDB, jetable) ----------
  const cache = new Collection({
    type: "base",
    name: "cache_source",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "source", required: true },
      { type: "text", name: "id_source", required: true },
      { type: "text", name: "type_donnee", required: true },
      { type: "json", name: "donnees", maxSize: 5000000 },
      { type: "date", name: "recupere_le", required: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_cache_source ON cache_source (source, id_source, type_donnee)",
      "CREATE INDEX idx_cache_date ON cache_source (recupere_le)",
    ],
  });
  app.save(cache);

  // ---------- reglages (un seul enregistrement) ----------
  const reglages = new Collection({
    type: "base",
    name: "reglages",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: "",
    deleteRule: null,
    fields: [{ type: "date", name: "dernier_export" }],
  });
  app.save(reglages);
  app.save(new Record(reglages)); // l'unique enregistrement, vide au départ
}, (app) => {
  // Annulation : on supprime dans l'ordre inverse (visionnages dépend de titres)
  for (const nom of ["reglages", "cache_source", "visionnages", "titres"]) {
    try { app.delete(app.findCollectionByNameOrId(nom)); } catch (e) { /* déjà absente */ }
  }
});
