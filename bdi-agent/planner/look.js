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
        const result = Strategy.getBestSpawnTile(this.intention.beliefs.config?.map, this.intention.beliefs.me, this.intention.beliefs.enemies);

        let x, y;
        if (!result) {
            const other =  Strategy.randomReachableTile(this.intention.beliefs.config?.map, this.intention.beliefs.me, this.intention.beliefs.enemies);
            if (!other) return false;
            x = other?.x
            y = other?.y
            this.logger.debug("No spawn tile found, moving to random reachable tile.");
        }
        else {
            x = result?.x
            y = result?.y
        }

        this.logger.info(`Moving to random spawn tile: (${x}, ${y})`);
        // Move to the random tile
        await this.goTo.execute(x, y);
        return true;
    }

}

export { LookForParcelPlan };