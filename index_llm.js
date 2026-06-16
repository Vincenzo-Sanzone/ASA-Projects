import { LLMAgent } from "./llm-agent/index.js";

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

const llm = new LLMAgent(process.env.LLM_TOKEN);
llm.startAgent();