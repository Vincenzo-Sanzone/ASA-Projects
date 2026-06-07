import { COGNITIVE_PROMPT } from "../prompts/prompts.js";
import { Caller } from "../utility/index.js";
import { Logger } from "../../utility/index.js";

class Cognitive {

    /**
     * 
     * @param {Caller} caller 
     */
    constructor(caller) {
        this.caller = caller

        this.logger = new Logger("Cognitive:");
    }

    async answer(message) {
        const messages = this.caller.createMessage(COGNITIVE_PROMPT, message)

        const response = await this.caller.callModel(messages)

        return response
    }
}

export { Cognitive }