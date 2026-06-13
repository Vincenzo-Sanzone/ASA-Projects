import { Router, Cognitive } from "../llm/index.js";
import { Logger } from "../../utility/index.js";
import { Caller } from "./caller.js";
import { Strategy } from "../logic/strategy.js";
import { BDIAgent } from "../../bdi-agent/index.js";
class MessageHandler{

    /**
     * 
     * @param {Caller} caller
     * @param {BDIAgent} bdi 
     */
    constructor(caller, bdi) {
        this.caller = caller
        this.bdi = bdi

        this.logger = new Logger("MessageHandler:");
    }

    /**
     * 
     * @param {String} id - id of the user who sent the message
     * @param {String} name - the name of the user
     * @param {String} messages - the message 
     */
    async handleMessage(id, name, messages) {
        this.logger.info("Handling message...", messages);
        // The BDI sent this message, so handle it in the traditional way
        if (id === this.bdi.teammateId) this.bdi.handleMessage(id, name, messages);

        const router = new Router(this.caller)
        // Determine the type of the message
        const type = await router.route(messages);
        console.log(`Router answered with type: ${type}`);
        // If the message is a tool mission, then we use the tool to handle it
        if (type === "TOOL_MISSION") {
            const strategy = new Strategy(this.bdi, this.caller)
            strategy.solve(messages)
            this.bdi.desires.generateDesires(this.bdi.belief);
            this.bdi.intentions.addIntentions(this.bdi.desires.desires);
        }
        // If the message is a cognitive mission, then we answer it
        else if (type === "COGNITIVE_MISSION") {
            const cognitive = new Cognitive(this.caller)
            const response = await cognitive.answer(messages)
            this.bdi.socket.emitSay(id, response)
        }
        else this.logger.error(`Router answered with unknown type: ${type}`);

    }
}

export { MessageHandler }