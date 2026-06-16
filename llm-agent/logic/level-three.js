import { Logger, Mission, TYPE_MISSION, Coordinator } from "../../utility/index.js";
import { BDIAgent } from "../../bdi-agent/index.js";
import { MissionParser } from "../llm/mission.js";

class LevelThreeSolver {

    /**
     * 
     * @param {MissionParser} parser 
     * @param {BDIAgent} bdi 
     */
    constructor(parser, bdi) {
        this.parser = parser;
        this.tools = {
            moveNear: this.#moveNear.bind(this),
            crossAgentDelivery: this.#crossAgentDelivery.bind(this),
            redGreenLight: this.#redGreenLight.bind(this),
            stop: this.#stop.bind(this),
            resume: this.#resume.bind(this)
        };
        this.bdi = bdi;

        this.logger = new Logger("LevelThreeSolver:", bdi.belief.me.name);
    }

    async solveCoordination(message) {
        const response = await this.parser.solveLevelThree(message);
        this.logger.info(JSON.stringify(response));
        if (this.tools[response.action] === undefined) {
            this.logger.error(`Unknown tool: ${response.action}`);
            return;
        }
        const mission = await this.tools[response.action](response);

        if (response.action === "stop" || response.action === "resume") return;

        if (mission === undefined || mission.length === 0) {
            this.logger.error(`Didn't get a mission from the tool: ${response.action}`);
            return;
        }
        if (response.action === TYPE_MISSION.MOVE_NEAR) {
            for (const m of mission) {
                await this.bdi.coordinator.sendMission(m);
                this.bdi.belief.addMission(m);
            }
        }
        else {
            await this.bdi.coordinator.sendMission(mission);
            this.bdi.belief.addMission(mission);
            if (response.action === TYPE_MISSION.RED_GREEN_LIGHT) {await this.#stop();}
        }
    }

    #moveNear(response) {
        if (response.location === undefined || response.distance === undefined || response.reward === undefined || response.reward < 1) return undefined;
        
        const missions = [];
        for (let i = 0; i < response.location.length; i += 2) {
            missions.push(new Mission(TYPE_MISSION.MOVE_NEAR, false, "add", response.reward, { x: eval(response.location[i]), y: eval(response.location[i + 1]), distance: eval(response.distance) }));
        }
        return missions;
    }

    #crossAgentDelivery(response) {
        if (response.reward === undefined && response.multiplier === undefined) return undefined;
        if (response.reward <= 0 || response.multiplier < 1) return undefined;
        
        return new Mission(TYPE_MISSION.CROSS_AGENT, true);
    }

    #redGreenLight(response) {
        if (response.reward === undefined || response.reward <= 0) return undefined;

        let xOdd = null;
        let yOdd = null;

        for (let i=0; i < response.location?.length; i++) {
            let isOdd = true;
            if (response.location[i] === "even") isOdd=false;
            if (response.location[i+1] === "row") xOdd = isOdd;
            if (response.location[i+1] === "column") yOdd = isOdd;
        }
        
        return new Mission(TYPE_MISSION.RED_GREEN_LIGHT, true, "add", response.reward, { xOdd: xOdd, yOdd: yOdd });
    }

    async #stop() {
        await this.bdi.coordinator.sendStop();
        this.bdi.belief.playRedGreen = true;
    }

    async #resume() {
        await this.bdi.coordinator.sendResume();
        this.bdi.belief.playRedGreen = false;
        this.bdi.belief.waiting = false;
    }
}

export { LevelThreeSolver };