import { BDIAgent } from "../../bdi-agent/index.js";
import { Logger, Mission } from "../../utility/index.js";

class Strategy {
    /**
     * 
     * @param {BDIAgent} bdi 
     */
    constructor(bdi) {
        this.bdi = bdi;
        this.logger = new Logger("Strategy:");
    }


    async solve(response){
        if (response.type === "TYPE_1") await this.#solveAtomic(response)
        else if (response.type === "TYPE_2") await this.#solvePersistent(response)
        else if (response.type === "TYPE_3") await this.#solveCoordination(response)
        else this.logger.error(`Mission parser answered with unknown type: ${response.type}`);
    }

    async #solveAtomic(response) {
        // If we don't have a reward, then we don't need to do anything
        if(response.rewards.value <= 0) return;

        let mission = null;
        if (response.actions[0].tool === "move") {
            let x,y = 0;
            if (response.actions[0].args.x_expr && response.actions[0].args.y_expr) {
                x = eval(response.actions[0].args.x_expr);
                y = eval(response.actions[0].args.y_expr);
            }
            else if (response.actions[0].args.x && response.actions[0].args.y) {
                x = response.actions[0].args.x;
                y = response.actions[0].args.y;
            }
            mission = new Mission("move", false, {x: x, y: y});
        }
        else if (response.actions.tool === "drop") {
            const location = response.actions.args.location;
            if (location.startsWith("leftmost")) mission = new Mission("drop", false, {x: 0});
            else if (location.startsWith("rightmost")) mission = new Mission("drop", false, {x: this.bdi.belief.config.width - 1});
            else if (location.startsWith("topmost")) mission = new Mission("drop", false, {y: 0});
            else if (location.startsWith("bottommost")) mission = new Mission("drop", false , {y: this.bdi.belief.config.height - 1});
        }
        else throw new Error(`Unknown tool: ${response.actions.tool}`);

        this.bdi.belief.addMission(mission);
    }

    async #solvePersistent(response) {
    }

    async #solveCoordination(response) {
    }
}

export { Strategy };