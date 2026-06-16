import { DjsClientSocket } from "@unitn-asa/deliveroo-js-sdk";
import { Mission, Logger } from "./index.js";

class Coordinator {
    /**
     * 
     * @param {DjsClientSocket} socket
     */
    constructor(socket, teammateId, agentName) {
        this.socket = socket;
        this.teammateId = teammateId;

        this.lastSent = null;
        this.lastType = null;

        this.logger = new Logger("Coordinator:", agentName);
    }

    async #send(msg) {
        const asJSON = JSON.parse(msg);
        if (this.#canSend(asJSON)) {
            const result = await this.socket.emitSay(this.teammateId, msg);
            if (result === "failed") this.logger.error("Failed to send message to teammate", msg);
            else this.logger.debug("Message sent to teammate", msg);
            this.lastSent = new Date();
            this.lastType = asJSON.type;
        }
    }

    #canSend(msg) {
        return this.lastSent === null || new Date() - this.lastSent > 1000 || this.lastType !== msg.type;
    }

    /**
     * Function used by LLM to send a mission to the teammate
     * @param {Mission} mission 
     */
    async sendMission(mission) {
        const data = {
            type: "mission",
            mission
        }
        await this.#send(JSON.stringify(data));
    }

    /**
     * Comunicate to the teammate that i am already near the target
     */
    async sendWaitingNearTarget() {
        await this.#send(JSON.stringify({ type: "waitingNearTarget" }));
    }

    /**
     * Comunicate to the teammate that the mission near the target is done
     */
    async sendDone(first = true) {
        const data = { type: "done", first: first };
        await this.#send(JSON.stringify(data));
    }

    /**
     * Comunicate to the teammate that there is a red light
     */
    async sendStop() {
        await this.#send(JSON.stringify({ type: "stop" }));
    }

    /**
     * Comunicate to the teammate that there is a green light
     */
    async sendResume() {
        await this.#send(JSON.stringify({ type: "resume" }));
    }

    async sendMeetAt(position) {
        const data = { type: "meetAt", target: position };
        await this.#send(JSON.stringify(data));
    }

}

export { Coordinator };