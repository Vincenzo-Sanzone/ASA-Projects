import { Logger, Mission, TYPE_MISSION } from "../../utility/index.js";

class LevelOneSolver {
    constructor(parser, bdi) {
        this.parser = parser;
        this.tools = {
            move: this.#move.bind(this),
            drop: this.#drop.bind(this),
        };
        this.bdi = bdi;

        this.logger = new Logger("LevelOneSolver:", bdi.belief.me.name);
    }

    async solveAtomic(message) {
        const response = await this.parser.solveLevelOne(message);
        this.logger.info(JSON.stringify(response));
        // If we don't have a reward, then we don't need to do anything        
        if (this.tools[response.action] === undefined) this.logger.error(`Unknown tool: ${response.action}`);
        
        const mission = this.tools[response.action](response);
        
        if (mission === undefined) return

        this.bdi.belief.addMission(mission);
        this.bdi.coordinator.sendMission(mission);
    }

    /**
     * 
     * @returns {Mission}
     */
    #move(response) {
        const x = eval(response.location[0]);
        const y = eval(response.location[1]);
        
        return new Mission(TYPE_MISSION.MOVE, false, "add", response.reward, {x: x, y: y});
    }

    /**
     * 
     * @returns {Mission}
     */
    #drop(response) {
        if (response.reward <= 0) return;
        if (response.location[0].startsWith("left")) return new Mission(TYPE_MISSION.DROP, false, "add", response.reward, {x: 0});
        else if (response.location[0].startsWith("right")) return new Mission(TYPE_MISSION.DROP, false, "add", response.reward, {x: this.bdi.belief.config.map.width - 1});
        else if (response.location[0].startsWith("up")) return new Mission(TYPE_MISSION.DROP, false, "add", response.reward, {y: this.bdi.belief.config.map.height - 1});
        else if (response.location[0].startsWith("down")) return new Mission(TYPE_MISSION.DROP, false, "add", response.reward, {y: 0});
        else return new Mission(TYPE_MISSION.DROP, false, "add", response.reward, {x: eval(response.location[0]), y: eval(response.location[1])});
    }
}

export { LevelOneSolver };