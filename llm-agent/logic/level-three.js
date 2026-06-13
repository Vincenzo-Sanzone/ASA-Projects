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
            moveNear: this.#moveNear,
            crossAgentDelivery: this.#crossAgentDelivery,
            redGreenLight: this.#redGreenLight
        };
        this.bdi = bdi;

        this.logger = new Logger("LevelThreeSolver:");
    }

    async solveCoordination(message) {
        const response = await this.parser.solveLevelThree(message);

        if (this.tools[response.action] === undefined) this.logger.error(`Unknown tool: ${response.action}`);

        const mission = this.tools[response.action](response);

        if (mission === undefined) this.logger.error(`Didn't get a mission from the tool: ${response.action}`);

        if (response.action === TYPE_MISSION.MOVE_NEAR) {
            for (const m of mission) {
                this.bdi.coordinator.sendMission(m);
                this.bdi.belief.addMission(m);
            }
        }
        else {
            this.bdi.coordinator.sendMission(mission);
            this.bdi.belief.addMission(mission);
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
        if (response.location === undefined || (response.reward === undefined)) return undefined;
        if (response.reward <= 0) return undefined;

        let xOdd = null;
        let yOdd = null;

        for (let i=0; i < response.location.length; i++) {
            let isOdd = true;
            if (response.location[i] === "even") isOdd=false;
            if (response.location[i+1] === "row") xOdd = isOdd;
            if (response.location[i+1] === "column") yOdd = isOdd;
        }
        
        return new Mission(TYPE_MISSION.RED_GREEN_LIGHT, false, "add", response.reward, { xOdd: xOdd, yOdd: yOdd });
    }
}

export { LevelThreeSolver };