
import { parseLLMResponse } from "./parser.js";

class Caller {
    constructor(client, model) {
        this.client = client
        this.MODEL = model
    }

    async callModel(messages, { temperature = 0 } = {}) {
        const response = await this.client.chat.completions.create({
            model: this.MODEL,
            messages,
            temperature,
        });

        return response.choices?.[0]?.message?.content ?? "";
    }

    async callJSONResponse(messages, { temperature = 0 } = {}) {
        const response = await this.callModel(messages, { temperature });
        return parseLLMResponse(response);
    }

    createMessage(system, user) {
        return [{ role: "system", content: system }, { role: "user", content: user }]
    }
}

export { Caller }