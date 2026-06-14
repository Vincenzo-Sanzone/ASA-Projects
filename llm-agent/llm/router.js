import { PARSER_PROMPT } from "../prompts/prompts.js";
import { Caller } from "../utility/index.js";
import { Logger } from "../../utility/index.js";

class Router {

    /**
     * Class Router that routes a message to a tool or a cognitive mission
     * @param {Caller} caller 
     */
    constructor(caller) {
        this.caller = caller

        this.logger = new Logger("Router:", "AgentLLM");
    }

    /**
     * Call the LLM to route the message
     * @param {String} message 
     * @returns {Promise<String>} The type of the message
     */
    async route(message) {
        const messages = this.caller.createMessage(PARSER_PROMPT, message)

        const response = await this.caller.callJSONResponse(messages)

        this.logger.debug(`Respone type is: ${response.type}, response summary is: ${response.summary}`);

        return response.type
    }
}

export { Router }