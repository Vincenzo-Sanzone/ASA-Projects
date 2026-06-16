import "dotenv/config";
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import { Belief } from "./belief/belief.js";
import { Desires } from "./desires/desires.js";
import { decodeJWT, Movement, Coordinator, Mission } from "../utility/index.js";
import { IntentionsRevise } from "./intention/revise.js";
import { Planner } from "./planner/planner.js";
import { PickUpPlan, LookForParcelPlan, DeliverPlan, MissionPlan } from "./planner/index.js";
import { Pddl } from "../pddl/index.js";
import { MeetAtPlan } from "./planner/meetAt.js";


class BDIAgent {

  constructor(token, teammateToken) {
    this.socket = DjsConnect(process.env.HOST, token);
    this.teammateId = decodeJWT(teammateToken).id
    this.name = decodeJWT(token).name
    this.coordinator = new Coordinator(this.socket, this.teammateId, this.name);
    this.belief = new Belief(this.coordinator, this.teammateId, this.name);
    this.desires = new Desires(this.name);
    this.planner = new Planner(this.socket, this.name);
    this.planner.registerPlan(PickUpPlan);
    this.planner.registerPlan(LookForParcelPlan);
    this.planner.registerPlan(DeliverPlan);
    this.planner.registerPlan(MissionPlan);
    this.planner.registerPlan(MeetAtPlan)
    this.intentions = new IntentionsRevise(this.belief, this.planner, this.name);

    this.lastEventTime = Date.now();
    this.thinking = false;
  }

  #startSensing() {
    this.socket.onSensing((sensing) => {
      this.belief.updateParcel(sensing.parcels);
      this.belief.updateAgents(sensing.agents);
      this.belief.updateCrates(sensing.crates);
      this.requestThink();
    });

    this.socket.onYou((me) => {
      this.belief.updateMe(me);
      this.requestThink();
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

  async handleMessage(id, name, msg) {
    // If the message is not from my teammate, ignore it
    if (id !== this.teammateId) return
    const data = JSON.parse(msg);

    this.intentions.beliefs.isNeededReconsidering = true;
    if (data.type === "mission") {
      this.belief.addMission(Mission.fromJSON(data.mission));
    }
    else if (data.type === "waitingNearTarget") {
      this.belief.isMyTeammateWaiting = true;
    }
    else if (data.type === "done") {
      if (this.belief.thereIsCrossAgent()) {
        await this.socket.emitPutdown();
        this.belief.removePassingParcels();
      }
      this.belief.isMyTeammateWaiting = false;
      this.belief.waiting = false;
    }
    else if (data.type === "stop") {
      this.belief.playRedGreen = true;
    }
    else if (data.type === "resume") {
      this.belief.playRedGreen = false;
      this.belief.waiting = false;
    }
    else if (data.type === "meetAt") {
      this.belief.meetAt = data.target
    }

    this.requestThink();
  }

  requestThink() {
    this.lastEventTime = Date.now();
    this.#think();
  }

  #startWatchdog() {
    setInterval(() => {
      const now = Date.now();

      const idleTime = now - this.lastEventTime;

      if (idleTime > 1000) {
        this.#think();
      }
    }, 500);
  }

  #think() {
    if (this.thinking) return;

    this.thinking = true;

    try {
        this.desires.generateDesires(this.belief);
        this.intentions.addIntentions(this.desires.desires);
    } finally {
        this.thinking = false;
    }
  } 

  startAgent() {
    this.#startSensing();
    this.#startWatchdog();
    this.intentions.loop();
  }
}

export { BDIAgent };