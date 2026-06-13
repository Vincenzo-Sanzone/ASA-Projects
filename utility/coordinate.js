import { DjsClientSocket } from "@unitn-asa/deliveroo-js-sdk";
import { Mission } from "./index.js";

class Coordinator {
    /**
     * 
     * @param {DjsClientSocket} socket
     */
    constructor(socket, teammateId) {
        this.socket = socket;
        this.teammateId = teammateId;
    }

    #send(msg) {
        this.socket.emitSay(this.teammateId, msg);
    }

    /**
     * Function used by LLM to send a mission to the teammate
     * @param {Mission} mission 
     */
    sendMission(mission) {
        const data = {
            type: "mission",
            mission
        }
        this.#send(JSON.stringify(data));
    }

    /**
     * Comunicate to the teammate that i am already near the target
     */
    sendWaitingNearTarget() {
        this.#send(JSON.stringify({ type: "waitingNearTarget" }));
    }

    /**
     * Comunicate to the teammate that the mission near the target is done
     */
    sendDone() {
        this.#send(JSON.stringify({ type: "done" }));
    }


    /**
     * Comunicate to the teammate that the mission red/green light is done
     */
    sendResume() {
        this.#send(JSON.stringify({ type: "resume" }));
    }

    

}

export { Coordinator };