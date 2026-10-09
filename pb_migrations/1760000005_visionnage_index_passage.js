/// <reference path="../pb_data/types.d.ts" />

// L'unicité d'un épisode (même titre, même saison, même épisode) tient désormais compte du passage :
// on peut cocher le même épisode une fois par passage (première fois, revisionnage n°1, etc.).
migrate((app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.removeIndex("idx_visionnages_episode");
  visionnages.addIndex("idx_visionnages_episode", true, "titre, saison, episode, passage", "episode > 0");
  app.save(visionnages);
}, (app) => {
  const visionnages = app.findCollectionByNameOrId("visionnages");
  visionnages.removeIndex("idx_visionnages_episode");
  visionnages.addIndex("idx_visionnages_episode", true, "titre, saison, episode", "episode > 0");
  app.save(visionnages);
});
