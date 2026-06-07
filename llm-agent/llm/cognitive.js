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

        this.logger.debug(`Response is: ${response}`);

        if (response.startsWith("Calculator:")) {
            const expr = response.slice("Calculator:".length).trim()
            return String(eval(expr))
        }
        return response
    }
}

export { Cognitive }