/// <reference path="../pb_data/types.d.ts" />

// Ajoute le champ « passage » aux visionnages : 1 = première fois, 2 = premier revisionnage, etc.
// Sert au revisionnage d'une série : chaque épisode est coché une fois PAR passage.
// Rappel : PocketBase range « vide » comme 0 ; 0 et 1 veulent donc tous deux dire « première fois ».
migrate((app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.fields.add(new NumberField({ name: "passage", min: 0, onlyInt: true }));
  app.save(visionnages);
}, (app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.fields.removeByName("passage");
  app.save(visionnages);
});
