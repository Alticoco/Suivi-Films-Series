/// <reference path="../pb_data/types.d.ts" />

// Ajoute le champ « coup de cœur » aux titres (une case à cocher, décochée par défaut).
// PocketBase exécute ce fichier tout seul au démarrage, une seule fois.
migrate((app) => {
  const titres = app.findCollectionByNameOrId("titres");
  titres.fields.add(new BoolField({ name: "coup_de_coeur" }));
  app.save(titres);
}, (app) => {
  const titres = app.findCollectionByNameOrId("titres");
  titres.fields.removeByName("coup_de_coeur");
  app.save(titres);
});
