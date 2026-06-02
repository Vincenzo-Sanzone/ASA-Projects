import "dotenv/config";
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import { Belief } from "./belief/belief.js";
import { Desires } from "./desires/desires.js";
import { Movement } from "../utility/index.js";
import { IntentionsRevise } from "./intention/revise.js";
import { Planner } from "./planner/planner.js";
import { PickUpPlan, LookForParcelPlan, DeliverPlan } from "./planner/index.js";
import { Pddl, GoToPddl } from "../pddl/index.js";


// Salva il metodo originale
const originalConsoleLog = console.log;

// Sovrascrivi console.log
console.log = (...args) => {
  // Controlla se il primo argomento è un log "tuo" (ha il formato atteso)
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    firstArg.includes('[') && // Contiene le parentesi del timestamp/level
    firstArg.includes(']') &&
    (firstArg.includes('[DEBUG]') ||
     firstArg.includes('[INFO]') ||
     firstArg.includes('[WARN]') ||
     firstArg.includes('[ERROR]'))
  ) {
    // Mostra solo i tuoi log
    originalConsoleLog(...args);
  }
  // Ignora tutto il resto (log delle librerie)
};

const socket = DjsConnect(process.env.HOST, process.env.TOKEN);
const belief = new Belief();
const desires = new Desires();
const planner = new Planner(socket);
planner.registerPlan(PickUpPlan);
planner.registerPlan(LookForParcelPlan);
planner.registerPlan(DeliverPlan);
const intentions = new IntentionsRevise(belief, planner);

socket.onSensing((sensing) => {
    belief.updateParcel(sensing.parcels);
    belief.updateAgents(sensing.agents);
    desires.generateDesires(belief);
    intentions.addIntentions(desires.desires);
});

socket.onYou((me) => {
  belief.updateMe(me);
  desires.generateDesires(belief);
  intentions.addIntentions(desires.desires); 
});

socket.onConfig((config) => {belief.updateConfig(config); desires.generateDesires(belief); });

const cachePopulator = new GoToPddl(null, null);

socket.onMap(() => {
  Movement.invalidateCache(); 
  Pddl.clearCache();
  cachePopulator.populateCache(belief.config.map);
});

intentions.loop();