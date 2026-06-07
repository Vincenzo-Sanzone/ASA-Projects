import OpenAI from "openai";
import { BDIAgent } from "../bdi-agent/index.js";
import { Caller, MessageHandler } from "./utility/index.js";

class LLMAgent {

    constructor(token) {
        const baseURL = process.env.LITELLM_BASE_URL || "https://llm.bears.disi.unitn.it/v1";
        const apiKey = process.env.LITELLM_API_KEY;
        this.MODEL = process.env.LOCAL_MODEL || "llama-3.3-70b-lmstudio";
        if (!apiKey) {
            throw new Error("Missing LITELLM_API_KEY environment variable");
        }
        this.client = new OpenAI({baseURL, apiKey})
        this.caller = new Caller(this.client, this.MODEL)
        this.bdi = new BDIAgent(token)

        this.handler = new MessageHandler(this.caller, this.bdi)
    }

    #listenToMessages() {
        this.bdi.socket.onMsg((id, name, msg) => {this.handler.handleMessage(id, msg)})
    }

    startAgent() {
        this.#listenToMessages()
        this.bdi.startAgent()
    }

}

export { LLMAgent }