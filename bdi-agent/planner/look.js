import { Plan } from "./planner.js";
import { Logger, Strategy } from "../../utility/index.js";
import { GoToPlan } from "./go-to.js";

/**
 * Plan to look for new parcels by moving to a random walkable tile.
 * Useful when no parcels are visible.
 */
class LookForParcelPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("LookForParcelPlan:", intention.beliefs.me.name);
    }

    static isApplicable(action) {
        return action === 'lookForParcel';
    }

    stop() {
        super.stop();
        this.goTo.stop();
    }

    async execute() {
        // Calculate best spawn tile to move
        const { x, y } = Strategy.getBestSpawnTile(this.intention.beliefs.config?.map, this.intention.beliefs.me);

        this.logger.info(`Moving to random spawn tile: (${x}, ${y})`);
        // Move to the random tile
        await this.goTo.execute(x, y);
        return true;
    }

}

export { LookForParcelPlan };