import { MISSION_PARSER_PROMPT } from "../prompts/prompts.js";
import { Caller } from "../utility/index.js";
import { Logger } from "../../utility/index.js";

class Mission {

    /**
     * Class Router that routes a message to a tool or a cognitive mission
     * @param {Caller} caller 
     */
    constructor(caller) {
        this.caller = caller

        this.logger = new Logger("Mission:");
    }

    /**
     * Call the LLM to route the message
     * @param {String} message 
     * @returns {Promise<Object>} The JSON response from the LLM
     */
    async route(message) {
        const messages = this.caller.createMessage(MISSION_PARSER_PROMPT, message)

        const response = await this.caller.callJSONResponse(messages)

        return response
    }
}

export { Mission }