/// <reference path="../pb_data/types.d.ts" />

// Ajoute le champ « avant » aux visionnages : « vu avant, date inconnue ».
// Sert à dire « j'ai vu cette série jusqu'à tel épisode avant de créer le site » sans inventer de date
// et sans prétendre qu'elle a été vue en entier. Un visionnage « avant » n'a pas de date.
// PocketBase exécute ce fichier tout seul au démarrage, une seule fois.
migrate((app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.fields.add(new BoolField({ name: "avant" }));
  app.save(visionnages);
}, (app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.fields.removeByName("avant");
  app.save(visionnages);
});
