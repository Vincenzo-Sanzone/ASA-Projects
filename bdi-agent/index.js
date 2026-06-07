import "dotenv/config";
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import { Belief } from "./belief/belief.js";
import { Desires } from "./desires/desires.js";
import { Movement } from "../utility/index.js";
import { IntentionsRevise } from "./intention/revise.js";
import { Planner } from "./planner/planner.js";
import { PickUpPlan, LookForParcelPlan, DeliverPlan, MissionPlan } from "./planner/index.js";
import { Pddl } from "../pddl/index.js";


class BDIAgent {

  constructor(token) {
    this.socket = DjsConnect(process.env.HOST, token);
    this.belief = new Belief();
    this.desires = new Desires();
    this.planner = new Planner(this.socket);
    this.planner.registerPlan(PickUpPlan);
    this.planner.registerPlan(LookForParcelPlan);
    this.planner.registerPlan(DeliverPlan);
    this.planner.registerPlan(MissionPlan);
    this.intentions = new IntentionsRevise(this.belief, this.planner);
  }

  #startSensing() {
    this.socket.onSensing((sensing) => {
      this.belief.updateParcel(sensing.parcels);
      this.belief.updateAgents(sensing.agents);
      this.belief.updateCrates(sensing.crates);
      this.desires.generateDesires(this.belief);
      this.intentions.addIntentions(this.desires.desires);
    });

    this.socket.onYou((me) => {
      this.belief.updateMe(me);
      this.desires.generateDesires(this.belief);
      this.intentions.addIntentions(this.desires.desires);
    });

    this.socket.onConfig((config) => { this.belief.updateConfig(config); });

    this.socket.onMap(() => {
      Movement.invalidateCache();
      Pddl.clearCache();
    });

    this.socket.onDisconnect((reason) => {
      console.log("[DEBUG] Disconnected from Deliveroo, shutting down...", reason);
      process.exit(0);
    });
  }

  startAgent() {
    this.#startSensing();
    this.intentions.loop();
  }
}

export { BDIAgent };