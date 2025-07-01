export class ActivistsItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["activists", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  get template() {
    const path = "systems/lostconnection/templates/item";
    return `${path}/${this.item.type}-sheet.html`;
  }

  getData() {
    const context = super.getData();
    const itemData = context.data;
    
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Type-specific data
    if (itemData.type === 'conviction') {
      context.convictionTypes = {
        weak: "Weak",
        stable: "Stable", 
        strong: "Strong"
      };
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Conviction-specific handlers
    if (this.item.type === 'conviction') {
      html.find('.damage-max').change(this._onDamageMaxChange.bind(this));
    }
  }

  async _onDamageMaxChange(event) {
    const newMax = parseInt(event.currentTarget.value);
    const updates = {'system.damage.max': newMax};
    
    // Reset current damage if it exceeds new max
    if (this.item.system.damage.value > newMax) {
      updates['system.damage.value'] = newMax;
    }
    
    await this.item.update(updates);
  }
}