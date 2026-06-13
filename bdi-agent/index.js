import "dotenv/config";
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import { Belief } from "./belief/belief.js";
import { Desires } from "./desires/desires.js";
import { decodeJWT, Movement, Coordinator, Mission } from "../utility/index.js";
import { IntentionsRevise } from "./intention/revise.js";
import { Planner } from "./planner/planner.js";
import { PickUpPlan, LookForParcelPlan, DeliverPlan, MissionPlan } from "./planner/index.js";
import { Pddl } from "../pddl/index.js";


class BDIAgent {

  constructor(token, teammateToken) {
    this.socket = DjsConnect(process.env.HOST, token);
    this.teammateId = decodeJWT(teammateToken).id
    this.coordinator = new Coordinator(this.socket, this.teammateId);
    this.belief = new Belief(this.coordinator);
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

    this.socket.onMsg((id, name, msg) => { this.handleMessage(id, name, msg); });

    this.socket.onDisconnect((reason, other) => {
      console.log("[DEBUG] Disconnected from Deliveroo, shutting down...", reason, other);
      process.exit(0);
    });
  }

  handleMessage(id, name, msg) {
    // If the message is not from my teammate, ignore it
    if (id !== this.teammateId) return
    const data = JSON.parse(msg);

    if (data.type === "mission") {
      this.belief.addMission(Mission.fromJSON(data.mission));
    }
    else if (data.type === "waitingNearTarget") {
      this.belief.isMyTeammateWaiting = true;
    }
    else if (data.type === "done") {
      if (!this.belief.isMyTeammateWaiting) {
        this.coordinator.sendDone();
      }
      this.belief.isMyTeammateWaiting = false;
      this.belief.waiting = false;
    }
    else if (data.type === "resume") {
      this.belief.waiting = false;
    }

    this.desires.generateDesires(this.belief);
    this.intentions.addIntentions(this.desires.desires);
  }

  startAgent() {
    this.#startSensing();
    this.intentions.loop();
  }
}

export { BDIAgent };