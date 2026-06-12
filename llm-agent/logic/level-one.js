import { Logger, Mission } from "../../utility/index.js";

class LevelOneSolver {
    constructor(parser, bdi) {
        this.parser = parser;
        this.tools = {
            move: this.#move,
            moveMost: this.#moveMost,
        };
        this.bdi = bdi;

        this.logger = new Logger("LevelOneSolver:");
    }

    async solveAtomic(message) {
        const response = await this.parser.solveLevelOne(message);
        console.log("[DEBUG] Solving atomic mission", JSON.stringify(response, null, 2));
        // If we don't have a reward, then we don't need to do anything
        if(response.rewards <= 0) return;
        
        if (this.tools[response.action] === undefined) this.logger.error(`Unknown tool: ${response.action}`);
        
        const mission = this.tools[response.action](...response.input);
        
        if (mission === undefined) return

        this.bdi.belief.addMission(mission);
    }

    /**
     * 
     * @param {String} x 
     * @param {String} y 
     * @returns {Mission}
     */
    #move(x, y){
        x = eval(x);
        y = eval(y);
        
        this.logger.debug(`Moving to (${x}, ${y})`);
        return new Mission("move", false, {x: x, y: y});
    }

    /**
     * 
     * @param {String} direction 
     * @returns {Mission}
     */
    #moveMost(direction) {
        if (direction.startsWith("left")) return new Mission("move", false, {x: 0});
        else if (direction.startsWith("right")) return new Mission("move", false, {x: this.bdi.belief.config.width - 1});
        else if (direction.startsWith("up")) return new Mission("move", false, {y: 0});
        else if (direction.startsWith("down")) return new Mission("move", false, {y: this.bdi.belief.config.height - 1});
        else this.logger.error(`Unknown direction: ${direction}`);
    }
}

export { LevelOneSolver };