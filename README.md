# ASA-Projects

## Project Structure

```
/bdi-agent          → BDI core (beliefs, desires, intentions, plans)
    /belief         → Contains the agent's knowledge of the environment
    /desires        → Desire generation, here are also calculated priorities and sorted
    /intention      → Contains the agent's intentions loop, and revise strategy
    /planner        → Contains the agent's plan. Has the execution function of the intention
    index.js        → Create a BDI agent and start listening to messages and sensing events
/llm-agent          → LLM-based mission parsing and classification
    /llm            → LLM core, contains the interaction with the LLM
    /logic          → Contains the logic to interpret the LLM output
    /prompts        → Contains the system prompts for the LLM
    /utility        → Contains the utility functions for the LLM
    index.js        → Create a LLM agent and start listening to messages and sensing events
/pddl               → Call the PDDL solver. Containts also the problem generation.
    /domains        → Contains the PDDL domains
/utility            → Shared utilities
    /coordinate.js  → Coordination protocol
    /movement.js    → Movement protocol (a bit mixed with strategy.js)
    /strategy.js    → Strategy protocol (a bit mixed with movement.js)
/index_all.js       → Start both agents
/index_bdi.js       → Start only the BDI agent
/index_llm.js       → Start only the LLM agent
```

---

## Requirements
* `.env` file with:

```
HOST=http://localhost:8080
LOG_LEVEL=error

LITELLM_API_KEY=<api_key>

LLM_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijg2NzJlOSIsIm5hbWUiOiJBZ2VudExMTSIsInRlYW1JZCI6ImQ1MWExMyIsInRlYW1OYW1lIjoiQWdlbnRzIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3ODA4Mjc2MjR9.cTC8Mf2wAkQNWhaxaNsO3A7FeVMPIjgahNJC6pf4wic
BDI_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImIxZDkxNCIsIm5hbWUiOiJBZ2VudEJESSIsInRlYW1JZCI6ImEwOGYwMSIsInRlYW1OYW1lIjoiQWdlbnRzIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3ODA4Mjc2MzZ9.fYcYVaTnBLSAMqC5ZFbFR-VCwftrhlWUwiaRkUxVwIY
```

---

## Installation

```bash
npm install
```

---

## Running the Agent

Start both agents:

```bash
npm run start
```

Start only one agent:

```bash
npm run start:bdi # starts the BDI agent
npm run start:llm # starts the LLM agent
```