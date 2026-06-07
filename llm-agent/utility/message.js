import { Router, Cognitive } from "../llm/index.js";
import { Logger } from "../../utility/index.js";
import { Caller } from "./caller.js";
import { DjsClientSocket } from "@unitn-asa/deliveroo-js-sdk";

class MessageHandler{

    /**
     * 
     * @param {Caller} caller
     * @param {DjsClientSocket} socket 
     */
    constructor(caller, socket) {
        this.caller = caller
        this.socket = socket

        this.logger = new Logger("MessageHandler:");
    }

    async handleMessage(id, messages) {
        this.logger.info("Handling message...", messages);
        const router = new Router(this.caller)
        const type = await router.route(messages);
        if (type === "TOOL_MISSION") {

        }
        else if (type === "COGNITIVE_MISSION") {
            const cognitive = new Cognitive(this.caller)
            const response = await cognitive.answer(messages)
            this.socket.emitSay(id, response)
        }
        else this.logger.error(`Router answered with unknown type: ${type}`);

    }
}

export { MessageHandler }