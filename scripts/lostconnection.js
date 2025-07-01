import { ActivistsActorSheet } from "./actor-sheet.js";
import { ActivistsItemSheet } from "./item-sheet.js";
import { ActivistsRoll } from "./dice.js";

Hooks.once("init", async function() {
  console.log("Initializing Lost Connection System");

  // Define custom classes
  game.activists = {
    ActivistsActorSheet,
    ActivistsItemSheet,
    rollCheck: ActivistsRoll.rollCheck
  };

  // Define custom Roll class
  CONFIG.Dice.rolls.push(ActivistsRoll);

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("activists", ActivistsActorSheet, { 
    makeDefault: true,
    types: ["character"]
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("activists", ActivistsItemSheet, { 
    makeDefault: true,
    types: ["conviction", "signature", "equipment", "modification"]
  });

  // Register system settings
  game.settings.register("activists", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  // Preload Handlebars templates
  await preloadHandlebarsTemplates();
});

// Preload template partials
async function preloadHandlebarsTemplates() {
  const templatePaths = [
    "systems/lostconnection/templates/actor/parts/character-traits.html",
    "systems/lostconnection/templates/actor/parts/convictions.html",
    "systems/lostconnection/templates/actor/parts/authority.html",
    "systems/lostconnection/templates/actor/parts/equipment.html"
  ];
  return loadTemplates(templatePaths);
}

// Add Handlebars helpers
Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('add', function(a, b) {
  return a + b;
});

Handlebars.registerHelper('lte', function(a, b) {
  return a <= b;
});

Handlebars.registerHelper('times', function(n, block) {
  let accum = '';
  for(let i = 0; i < n; ++i) {
    block.data.index = i;
    block.data.first = i === 0;
    block.data.last = i === (n - 1);
    accum += block.fn(this);
  }
  return accum;
});

// Chat message hooks for custom rolls
Hooks.on("renderChatMessage", (message, html, data) => {
  // Handle Activists rolls
  if (message.isRoll && message.roll instanceof ActivistsRoll) {
    html.find(".dice-roll").addClass("activists-roll");
  }
});

// Global functions for macros and chat
window.ActivistsRoll = ActivistsRoll;