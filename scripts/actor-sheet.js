export class ActivistsActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["lostconnection", "sheet", "actor"],
      template: "systems/lostconnection/templates/actor/actor-sheet.html",
      width: 700,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "traits" }]
    });
  }

  get template() {
    return `systems/lostconnection/templates/actor/actor-sheet.html`;
  }

  getData() {
    const context = super.getData();
    const actorData = context.data;
    
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data
    if (actorData.type === 'character') {
      this._prepareCharacterData(context);
    }

    // Prepare items
    this._prepareItems(context);

    return context;
  }

  _prepareCharacterData(context) {
    // Calculate trait distributions
    for (let [key, trait] of Object.entries(context.system.traits)) {
      const [left, right] = trait.distribution.split("-").map(n => parseInt(n));
      trait.leftRange = `1-${left}`;
      trait.rightRange = `${parseInt(left) + 1}-6`;
    }

    // Authority levels
    context.fameRanks = ["Shell", "Frame", "Glitch", "Storm", "Blast"];
    context.statusRanks = ["Ghost", "Mod", "Builder", "Guru", "Lead"];
  }

  _prepareItems(context) {
    const convictions = {
      weak: [],
      stable: [],
      strong: []
    };
    const signatures = [];
    const equipment = [];
    const modifications = [];

    // Iterate through items
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      
      if (i.type === 'conviction') {
        if (i.system.type === 'weak') convictions.weak.push(i);
        else if (i.system.type === 'stable') convictions.stable.push(i);
        else if (i.system.type === 'strong') convictions.strong.push(i);
      }
      else if (i.type === 'signature') {
        signatures.push(i);
      }
      else if (i.type === 'equipment') {
        equipment.push(i);
      }
      else if (i.type === 'modification') {
        modifications.push(i);
      }
    }

    context.convictions = convictions;
    context.signatures = signatures;
    context.equipment = equipment;
    context.modifications = modifications;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers
    html.find('.roll-check').click(this._onRollCheck.bind(this));
    html.find('.roll-hope').click(this._onRollHope.bind(this));

    // Trait distribution handlers
    html.find('.trait-slider').change(this._onTraitChange.bind(this));

    // Despair handlers
    html.find('.despair-control').click(this._onDespairControl.bind(this));

    // Conviction handlers
    html.find('.conviction-damage').click(this._onConvictionDamage.bind(this));
    html.find('.conviction-use').click(this._onConvictionUse.bind(this));

    // Equipment handlers
    html.find('.equipment-use').click(this._onEquipmentUse.bind(this));
    html.find('.equipment-repair').click(this._onEquipmentRepair.bind(this));

    // Modification handlers
    html.find('.mod-activate').click(this._onModActivate.bind(this));

    // Authority handlers
    html.find('.authority-change').change(this._onAuthorityChange.bind(this));
    html.find('.drain-toggle').click(this._onDrainToggle.bind(this));

    // Reflection tracker
    html.find('.reflection-mark').click(this._onReflectionMark.bind(this));

    html.find('.add-conviction').click(this._onAddConviction.bind(this));
    html.find('.add-equipment').click(this._onAddEquipment.bind(this));
    html.find('.add-modification').click(this._onAddModification.bind(this));
    html.find('.item-control').click(this._onItemControl.bind(this));
  }

  async _onRollCheck(event) {
    event.preventDefault();
    const element = event.currentTarget;
    
    // Get selected traits
    const selectedTraits = [];
    const traitCheckboxes = this.form.querySelectorAll('.trait-select:checked');
    
    traitCheckboxes.forEach(checkbox => {
      const traitKey = checkbox.dataset.trait;
      const trait = this.actor.system.traits[traitKey];
      const side = checkbox.dataset.side;
      
      selectedTraits.push({
        name: side === 'left' ? trait.name.split(' - ')[0] : trait.name.split(' - ')[1],
        range: side === 'left' ? trait.leftRange : trait.rightRange
      });
    });

    if (selectedTraits.length === 0) {
      ui.notifications.warn("Select at least one trait for the check!");
      return;
    }

    // Show dialog for difficulty and options
    const dialogContent = await renderTemplate("systems/lostconnection/templates/dialogs/roll-dialog.html", {
      traits: selectedTraits,
      signatures: this.actor.items.filter(i => i.type === 'signature'),
      hasHelp: true
    });

    new Dialog({
      title: "Character Check",
      content: dialogContent,
      buttons: {
        roll: {
          label: "Roll",
          callback: async (html) => {
            const difficulty = parseInt(html.find('[name="difficulty"]').val());
            const signature = html.find('[name="signature"]:checked').val();
            const help = html.find('[name="help"]').is(':checked');
            const actionName = html.find('[name="actionName"]').val();

            await ActivistsRoll.rollCheck(this.actor, selectedTraits, {
              difficulty,
              signature: signature === 'true',
              help,
              actionName
            });
          }
        },
        cancel: {
          label: "Cancel"
        }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollHope(event) {
    event.preventDefault();
    
    const convictions = this.actor.items.filter(i => i.type === 'conviction');
    const numConvictions = convictions.length;
    
    if (numConvictions === 0) {
      ui.notifications.warn("You need at least one conviction to roll Hope!");
      return;
    }

    const roll = new Roll(`${numConvictions}d6kh1`);
    await roll.evaluate({async: true});
    
    const currentDespair = this.actor.system.despair.value;
    const reduction = roll.total;
    const newDespair = Math.max(0, currentDespair - reduction);
    
    await this.actor.update({'system.despair.value': newDespair});
    
    const flavor = `<div class="hope-roll">
      <h4>Hope Roll</h4>
      <p>Despair reduced by ${reduction}</p>
      <p>${currentDespair} → ${newDespair}</p>
    </div>`;
    
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      flavor: flavor
    });
  }

  async _onTraitChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const trait = element.dataset.trait;
    const value = parseInt(element.value);
    
    const left = value;
    const right = 6 - value;
    
    await this.actor.update({
      [`system.traits.${trait}.distribution`]: `${left}-${right}`,
      [`system.traits.${trait}.left`]: left,
      [`system.traits.${trait}.right`]: right
    });
  }

  async _onDespairControl(event) {
    event.preventDefault();
    const action = event.currentTarget.dataset.action;
    const current = this.actor.system.despair.value;
    
    let newValue = current;
    if (action === 'increase') newValue = Math.min(10, current + 1);
    else if (action === 'decrease') newValue = Math.max(0, current - 1);
    
    await this.actor.update({'system.despair.value': newValue});
    
    // Check for Breakdown at 10
    if (newValue === 10) {
      ui.notifications.warn("Breakdown! Choose to lose a Conviction or take dramatic action!");
    }
  }

  async _onConvictionDamage(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const action = event.currentTarget.dataset.action;
    
    const current = item.system.damage.value;
    let newValue = current;
    
    if (action === 'increase') newValue = Math.min(item.system.damage.max, current + 1);
    else if (action === 'decrease') newValue = Math.max(0, current - 1);
    
    await item.update({'system.damage.value': newValue});
    
    // Check if conviction is lost
    if (newValue >= item.system.damage.max) {
      ui.notifications.warn(`Conviction "${item.name}" is lost!`);
    }
  }

  async _onEquipmentUse(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    await item.update({'system.needsRepair': true});
    ui.notifications.info(`${item.name} needs repair!`);
  }

  async _onModActivate(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item.system.usedThisSession) {
      await item.update({'system.usedThisSession': true});
      ui.notifications.info(`${item.name} activated!`);
    } else {
      // Additional activation causes +4 Despair
      const newDespair = Math.min(10, this.actor.system.despair.value + 4);
      await this.actor.update({'system.despair.value': newDespair});
      ui.notifications.warn(`${item.name} overused! +4 Despair!`);
    }
  }

  async _onAuthorityChange(event) {
    const field = event.currentTarget.name;
    const value = event.currentTarget.value;
    await this.actor.update({[field]: value});
  }

  async _onDrainToggle(event) {
    event.preventDefault();
    const current = this.actor.system.authority.drain;
    await this.actor.update({'system.authority.drain': !current});
  }

  async _onReflectionMark(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type; // 'ethical' or 'shadow'
    const current = this.actor.system.reflection[type];
    
    if (current < 6) {
      await this.actor.update({[`system.reflection.${type}`]: current + 1});
    }
    
    // Check if reflection track is full
    const ethical = this.actor.system.reflection.ethical;
    const shadow = this.actor.system.reflection.shadow;
    
    if (ethical + shadow >= 6) {
      ui.notifications.info("Reflection track full! Time to gain Conviction!");
    }
  }

 async _onAddConviction(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    
    const itemData = {
      name: `New ${type} Conviction`,
      type: 'conviction',
      system: {
        type: type,
        damage: {
          value: 0,
          max: type === 'weak' ? 1 : type === 'stable' ? 2 : 3
        }
      }
    };
    
    await this.actor.createEmbeddedDocuments('Item', [itemData]);
  }

  async _onAddEquipment(event) {
    event.preventDefault();
    
    const itemData = {
      name: 'New Equipment',
      type: 'equipment',
      system: {
        condition: 'working',
        needsRepair: false
      }
    };
    
    await this.actor.createEmbeddedDocuments('Item', [itemData]);
  }

  async _onAddModification(event) {
    event.preventDefault();
    
    const itemData = {
      name: 'New Modification',
      type: 'modification',
      system: {
        usedThisSession: false
      }
    };
    
    await this.actor.createEmbeddedDocuments('Item', [itemData]);
  }

  async _onItemControl(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (element.classList.contains('item-edit')) {
      item.sheet.render(true);
    } else if (element.classList.contains('item-delete')) {
      await item.delete();
    }
  }
}