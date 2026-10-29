import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import { attackRollDialog,attackRollDialogV2,defendRollDialog } from '../roll_dialog.mjs';

const contextEventsFallback = () => [
  { title: 'Poteri oscuri e mutazioni', entries: [] },
  { title: 'Legami, debiti e giuramenti', entries: [] },
  { title: 'Segreti e conoscenze proibite', entries: [] },
  { title: 'Ferite e conseguenze', entries: [] },
];

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class Bpnb_borgActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['bpnb_borg', 'sheet', 'actor'],
      width: 600,
      height: 600,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'features',
        },
      ],
    });
  }

  /** @override */
  get template() {
    return `systems/bpnb-borg/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.data;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();
    context.events = context.system.events ?? contextEventsFallback();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle ability scores.
    for (let [k, v] of Object.entries(context.system.abilities)) {
      //console.log("translation key:" + k);
      v.label = game.i18n.localize(CONFIG.BPNB_BORG.abilities[k]) ?? k;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const features = [];
    const spells = [];
    const weapons = [];
    const armour = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to gear.
      if (i.type === 'item') {
        gear.push(i);
      }
      // Append to features.
      else if (i.type === 'feature') {
        features.push(i);
      }
      // Append to spells.
      else if (i.type === 'spell') {
        spells.push(i);
      }
      // Append to weapons
      else if (i.type === 'weapon') {
        weapons.push(i);
      }
      // Append to armour
      else if (i.type === 'armour') {
        armour.push(i);
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.spells = spells;
    context.weapons = weapons;
    context.armour = armour;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.on('click','#action_short_rest',(ev) =>{
      const actorRollData = this.actor.getRollData();
      const attackRoll = new Roll("1d4", actorRollData);
      attackRoll.evaluate().then((roll) => {
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: game.i18n.localize('BPNB_BORG.UI.ShortRestFlavor'),
          rollMode: game.settings.get('core', 'rollMode'),
        });
      });
    });

    html.on('click','#action_long_rest',(ev) =>{
      const actorRollData = this.actor.getRollData();
      const attackRoll = new Roll("1d6", actorRollData);
      attackRoll.evaluate().then((roll) => {
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: game.i18n.localize('BPNB_BORG.UI.LongRestFlavor'),
          rollMode: game.settings.get('core', 'rollMode'),
        });
      });
    });

    html.on('click','#action_defend',(ev) =>{
      defendRollDialog(this.actor, this.actor.system.abilities.agl.value);
    });

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    html.on("click", ".post-item-description", (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));

      let html = '<h2>' + item.name + '</h2>';
      html += '<p>' + item.system.description + '</p>';
      ChatMessage.create({
        content: html,
        sound: null,
        speaker: ChatMessage.getSpeaker(item.actor)
      });
    });

    html.on("change", ".item-ammunition", (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      const newValue = parseInt(ev.currentTarget.value);
      if (isNaN(newValue)) {
        //ui.notifications.error("Invalid value for ammunition");
        console.log("Invalid value for ammunition");
        return;
      }
      item.update({ "system.ammunition": newValue });
      return;
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Narrative events archive (stored on the actor; no mechanical effects).
    html.on('click', '.event-add', async (ev) => {
      ev.preventDefault();
      const groupIndex = Number(ev.currentTarget.dataset.groupIndex);
      const events = foundry.utils.deepClone(this.actor.system.events ?? contextEventsFallback());
      if (!events[groupIndex]) return;
      events[groupIndex].entries ??= [];
      events[groupIndex].entries.push({ title: '', description: '' });
      await this.actor.update({ 'system.events': events });
    });

    html.on('click', '.event-delete', async (ev) => {
      ev.preventDefault();
      const groupIndex = Number(ev.currentTarget.dataset.groupIndex);
      const entryIndex = Number(ev.currentTarget.dataset.entryIndex);
      const events = foundry.utils.deepClone(this.actor.system.events ?? contextEventsFallback());
      if (!events[groupIndex]?.entries?.[entryIndex]) return;
      events[groupIndex].entries.splice(entryIndex, 1);
      await this.actor.update({ 'system.events': events });
    });

    html.on('change', '.event-field', async (ev) => {
      const { groupIndex, entryIndex, field } = ev.currentTarget.dataset;
      const events = foundry.utils.deepClone(this.actor.system.events ?? contextEventsFallback());
      const entry = events[Number(groupIndex)]?.entries?.[Number(entryIndex)];
      if (!entry || !['title', 'description'].includes(field)) return;
      entry[field] = ev.currentTarget.value;
      await this.actor.update({ 'system.events': events });
    });

    // Active Effect management
    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = { ...header.dataset };
    // Initialize a default name.
    const nameKeys = {
      weapon: 'BPNB_BORG.UI.AddWeaponName',
      armour: 'BPNB_BORG.UI.AddArmourName',
      item: 'BPNB_BORG.UI.AddItemName',
      spell: 'BPNB_BORG.UI.AddSpellName',
      feature: 'BPNB_BORG.UI.AddFeatureName',
    };
    const name = game.i18n.localize(nameKeys[type] ?? 'BPNB_BORG.UI.AddItemName');
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system['type'];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle weapon rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'weapon') {
        const item = this.actor.items.get(dataset.itemId);
        let label = item.name;
        if (item) {
          let rollFormula = "d20 +";

          if (item.system.ranged) {
            rollFormula += this.actor.system.abilities.prs.value;
            label += " - Presence (Ranged) + " + this.actor.system.abilities.prs.value;;
          } else {
            rollFormula += this.actor.system.abilities.str.value;
            label += " - Strength (Melee) + " + this.actor.system.abilities.str.value;;
          }
          attackRollDialogV2(this.actor, dataset.itemId, rollFormula, label,item.system.damage);
        }
      } else if (dataset.rollType == "spell") {
        const item = this.actor.items.get(dataset.itemId);
        let label = item.name;
        if (item) {
          let rollFormula = "d20 +";
          rollFormula += this.actor.system.abilities.prs.value;
          label += " - Presence (Magic) + " + this.actor.system.abilities.prs.value;
          attackRollDialog(this.actor, dataset.itemId, rollFormula, label);
        }
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      /*let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;*/
      attackRollDialog(this.actor, null, dataset.roll, dataset.label);
    }
  }
}
