import { PARSER_PROMPT } from "../prompts/prompts.js";
import { Caller } from "../utility/index.js";
import { Logger } from "../../utility/index.js";

class Router {

    /**
     * 
     * @param {Caller} caller 
     */
    constructor(caller) {
        this.caller = caller

        this.logger = new Logger("Router:");
    }

    async route(message) {
        const messages = this.caller.createMessage(PARSER_PROMPT, message)

        const response = await this.caller.callJSONResponse(messages)

        this.logger.debug(`Respone type is: ${response.type}, response summary is: ${response.summary}`);

        return response.type
    }
}

export { Router }