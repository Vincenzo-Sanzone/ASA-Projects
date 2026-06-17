import { BDIAgent } from "./bdi-agent/index.js";
import { LLMAgent } from "./llm-agent/index.js";
import { DeliveryCollaboration } from "./pddl/delivery-collaboration.js";

// Save original console.log
const originalConsoleLog = console.log;

// Override console.log so only our logs are shown
console.log = (...args) => {
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    firstArg.includes('[') &&
    firstArg.includes(']') &&
    (firstArg.includes('[DEBUG]') ||
      firstArg.includes('[INFO]') ||
      firstArg.includes('[WARN]') ||
      firstArg.includes('[ERROR]'))
  ) { originalConsoleLog(...args); }
};

const bdi = new BDIAgent(process.env.BDI_TOKEN, process.env.LLM_TOKEN);
bdi.startAgent();
const llm = new LLMAgent(process.env.LLM_TOKEN, process.env.BDI_TOKEN);
llm.startAgent();


let mapReady = false;
let mapReadyPromise = null;

deliveryCollaboration();

function waitForMap() {
  if (mapReady) return Promise.resolve();

  if (!mapReadyPromise) {
    mapReadyPromise = new Promise(resolve => {
      llm.bdi.socket.onMap(() => {
        mapReady = true;
        resolve();
      });
    });
  }

  return mapReadyPromise;
}

async function deliveryCollaboration() {
  await waitForMap();

  // Sleep for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));

  const deliveryCollaboration = new DeliveryCollaboration();

  deliveryCollaboration.addBelief(bdi.belief, { x: bdi.belief.me.x, y: bdi.belief.me.y }, { x: llm.bdi.belief.me.x, y: llm.bdi.belief.me.y });
  deliveryCollaboration.addGoal();
  const plan = await deliveryCollaboration.solve();
  if (!plan) {
    bdi.belief.collaborationRequired = true
    llm.bdi.belief.collaborationRequired = true
  }
}