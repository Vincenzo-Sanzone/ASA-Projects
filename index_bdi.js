import { BDIAgent } from "./bdi-agent/index.js";

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
  ) {originalConsoleLog(...args);}
};

const bdi = new BDIAgent(process.env.BDI_TOKEN, process.env.LLM_TOKEN);
bdi.startAgent();