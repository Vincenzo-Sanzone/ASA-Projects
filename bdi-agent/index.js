import "dotenv/config";
import { DjsConnect } from "@unitn-asa/deliveroo-js-sdk/client";
import { Belief } from "./belief/belief.js";
import { Desires } from "./desires/desires.js";
import { Movement } from "../utility/index.js";
import { IntentionsRevise } from "./intention/revise.js";
import { Planner } from "./planner/planner.js";
import { PickUpPlan, LookForParcelPlan, DeliverPlan } from "./planner/index.js";

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

socket.onYou((me) => {belief.updateMe(me); desires.generateDesires(belief); });

socket.onConfig((config) => {belief.updateConfig(config); desires.generateDesires(belief); });

socket.onMap(() => {Movement.invalidateCache(); });

intentions.loop();