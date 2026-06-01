import { Plan, GoToPlan } from "./planner.js";
import { Logger } from "../../utility/index.js";
/**
 * Plan to look for new parcels by moving to a random walkable tile.
 * Useful when no parcels are visible.
 */
class LookForParcelPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("LookForParcelPlan:");
    }

    static isApplicable(action) {
        return action === 'lookForParcel';
    }

    stop() {
        super.stop();
        this.goTo.stop();
    }

    async execute() {
        const { map } = this.intention.beliefs.config;
        const walkableTiles = [];

        // Collect all spwan tiles
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const tile = map.tiles[x][y];
                if (tile.toString() === '1') {
                    walkableTiles.push({ x, y });
                }
            }
        }

        if (walkableTiles.length === 0) {
            this.logger.error("No walkable tiles found!");
            return false;
        }

        // Pick a random walkable tile
        const randomIndex = Math.floor(Math.random() * walkableTiles.length);
        const { x, y } = walkableTiles[randomIndex];
        
        this.logger.info(`Moving to random spawn tile: (${x}, ${y})`);
        // Move to the random tile
        await this.goTo.execute(x, y);
        return !this.stopped;
    }
}

export { LookForParcelPlan };