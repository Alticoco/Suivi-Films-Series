/// <reference path="../pb_data/types.d.ts" />

// Ajoute aux visionnages la date à laquelle la ligne a été enregistrée (remplie automatiquement).
// Utile pour les épisodes « vus avant » : ils n'ont pas de date de visionnage, mais on sait quand
// on les a ajoutés (tableau de bord : « Vu avant · ajouté le … »). Vide pour les lignes déjà existantes.
migrate((app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.fields.add(new AutodateField({ name: "ajoute_le", onCreate: true, onUpdate: false }));
  app.save(visionnages);
}, (app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.fields.removeByName("ajoute_le");
  app.save(visionnages);
});
