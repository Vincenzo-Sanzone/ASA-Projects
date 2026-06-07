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

    /**
     * 
     * @param {String} id - id of the user who sent the message
     * @param {String} messages - the message 
     */
    async handleMessage(id, messages) {
        this.logger.info("Handling message...", messages);
        const router = new Router(this.caller)
        // Determine the type of the message
        const type = await router.route(messages);
        console.log(`Router answered with type: ${type}`);
        // If the message is a tool mission, then we use the tool to handle it
        if (type === "TOOL_MISSION") {

        }
        // If the message is a cognitive mission, then we answer it
        else if (type === "COGNITIVE_MISSION") {
            const cognitive = new Cognitive(this.caller)
            const response = await cognitive.answer(messages)
            this.socket.emitSay(id, response)
        }
        else this.logger.error(`Router answered with unknown type: ${type}`);

    }
}

export { MessageHandler }