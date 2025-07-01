export class ActivistsRoll extends Roll {
  constructor(formula, data, options) {
    super(formula, data, options);
    this.hits = 0;
    this.traits = options.traits || [];
    this.difficulty = options.difficulty || 1;
    this.convictionUsed = options.conviction || null;
  }

  static async rollCheck(actor, traits, options = {}) {
    // Base 2d6
    let numDice = 2;
    let formula = "2d6";

    // Add signature die if applicable
    if (options.signature) {
      numDice++;
      formula = "3d6";
    }

    // Add help die if applicable
    if (options.help) {
      numDice++;
      formula = numDice + "d6";
    }

    // Create the roll
    const roll = new ActivistsRoll(formula, {}, {
      traits: traits,
      difficulty: options.difficulty || 1,
      conviction: options.conviction
    });

    await roll.evaluate({async: true});

    // Calculate hits
    roll.calculateHits(traits);

    // Create chat message data
    const messageData = {
      speaker: ChatMessage.getSpeaker({actor: actor}),
      flavor: roll.buildFlavor(traits, options),
      rolls: [roll],
      rollMode: game.settings.get("core", "rollMode")
    };

    // Send to chat
    await ChatMessage.create(messageData);

    return roll;
  }

  calculateHits(traits) {
    this.hits = 0;
    const dice = this.dice[0].results;

    dice.forEach((die, index) => {
      traits.forEach(trait => {
        if (this.isHit(die.result, trait)) {
          this.hits++;
        }
      });
    });

    return this.hits;
  }

  isHit(value, trait) {
    const [min, max] = trait.range.split("-").map(n => parseInt(n));
    return value >= min && value <= max;
  }

  buildFlavor(traits, options) {
    let flavor = `<div class="activists-roll-header">`;
    flavor += `<h4>${options.actionName || "Character Check"}</h4>`;
    flavor += `<div class="traits">`;
    
    traits.forEach(trait => {
      flavor += `<span class="trait">${trait.name} (${trait.range})</span>`;
    });
    
    flavor += `</div>`;
    flavor += `<div class="difficulty">Difficulty: ${this.difficulty}</div>`;
    
    if (this.convictionUsed) {
      flavor += `<div class="conviction">Conviction Used: ${this.convictionUsed}</div>`;
    }
    
    flavor += `<div class="result ${this.hits >= this.difficulty ? 'success' : 'failure'}">`;
    flavor += `Hits: ${this.hits} / ${this.difficulty}`;
    flavor += `</div>`;
    flavor += `</div>`;

    return flavor;
  }

  async toMessage(messageData = {}, options = {}) {
    messageData.flavor = messageData.flavor || this.buildFlavor(this.traits, this.options);
    return super.toMessage(messageData, options);
  }
}

// Helper function for equipment rerolls
export function rerollDie(roll, dieIndex) {
  const formula = roll._formula;
  const dice = roll.dice[0];
  
  // Create new roll with same formula
  const newRoll = new Roll(formula);
  newRoll.evaluate({async: false});
  
  // Replace the specific die
  dice.results[dieIndex] = newRoll.dice[0].results[0];
  
  // Recalculate total
  roll._total = dice.results.reduce((sum, die) => sum + die.result, 0);
  
  return roll;
}

// Helper function for conviction flips
export function flipDie(dieValue) {
  const flips = {
    1: 6, 6: 1,
    2: 5, 5: 2,
    3: 4, 4: 3
  };
  return flips[dieValue] || dieValue;
}