/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates([
    // Actor partials.
    'systems/dark-age-foundry/templates/actor/parts/actor-features.hbs',
    'systems/dark-age-foundry/templates/actor/parts/actor-items.hbs',
    'systems/dark-age-foundry/templates/actor/parts/actor-spells.hbs',
    'systems/dark-age-foundry/templates/actor/parts/actor-weapons.hbs',
    'systems/dark-age-foundry/templates/actor/parts/actor-effects.hbs',
    'systems/dark-age-foundry/templates/actor/parts/actor-events.hbs',
    'systems/dark-age-foundry/templates/actor/parts/actor-armour.hbs',
    // Item partials
    'systems/dark-age-foundry/templates/item/parts/item-effects.hbs',
  ]);
};
