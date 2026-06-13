import { Logger, Mission, TYPE_MISSION } from "../../utility/index.js";

class LevelThreeSolver {
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
        console.log("[DEBUG] Solving coordination mission", JSON.stringify(response, null, 2));

        if (this.tools[response.action] === undefined) this.logger.error(`Unknown tool: ${response.action}`);

        const mission = this.tools[response.action](response);

        if (mission === undefined) this.logger.error(`Didn't get a mission from the tool: ${response.action}`);

        if (response.action === TYPE_MISSION.MOVE_NEAR) {
            for (const m of mission) {
                m.reward = response.rewards;
                this.bdi.belief.addMission(m);
            }
        }
        else {
            mission.reward = response.rewards;
            this.bdi.belief.addMission(mission);
        }
    }

    #moveNear(response) {
        if (response.location === undefined || response.distance === undefined || response.bonus === undefined || response.bonus < 1) return undefined;
        
        const missions = [];
        for (let i = 0; i < response.location.length; i += 2) {
            missions.push(new Mission(TYPE_MISSION.MOVE_NEAR, false, { x: eval(response.location[i]), y: eval(response.location[i + 1]), distance: response.distance, bonus: response.bonus }));
        }
        return missions;
    }

    #crossAgentDelivery(response) {
        if (response.bonus === undefined) return undefined;
        if (response.bonus <= 0) return undefined;
        
        return new Mission(TYPE_MISSION.CROSS_AGENT, true, { bonus: response.bonus });
    }

    #redGreenLight(response) {
        if (response.location === undefined || response.bonus === undefined) return undefined;
        if (response.bonus <= 0) return undefined;

        let xOdd = null;
        let yOdd = null;

        for (let i=0; i < response.location.length; i++) {
            let isOdd = true;
            if (response.location[i] === "even") isOdd=false;
            if (response.location[i+1] === "row") xOdd = isOdd;
            if (response.location[i+1] === "column") yOdd = isOdd;
        }
        
        return new Mission(TYPE_MISSION.RED_GREEN_LIGHT, false, { xOdd: xOdd, yOdd: yOdd });
    }
}

export { LevelThreeSolver };