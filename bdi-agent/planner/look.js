import { Plan, GoToPlan } from "./planner.js";
import { Logger, Movement } from "../../utility/index.js";
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

        // Calculate score for each walkable tile
        const scoredTiles = walkableTiles.map(tile => {
            // Count nearby spawns (within a certain radius, e.g., 3 tiles)
            const nearbySpawns = walkableTiles.filter(spawn =>
                Movement.getDistance(map, spawn, tile) <= 3
            ).length;

            // Check if there's a delivery nearby (within a certain radius, e.g., 5 tiles)
            const hasNearbyDelivery = Movement.getDeliveryPoints(map).some(delivery =>
                Movement.getDistance(map, delivery, tile) <= 5
            );

            // Score: prioritize tiles with more spawns and nearby deliveries
            const score = nearbySpawns * 2 + (hasNearbyDelivery ? 3 : 0);
            return { ...tile, score };
        });

        // Sort by score (descending) and pick the best
        scoredTiles.sort((a, b) => b.score - a.score);
        const {x, y} = scoredTiles[0];
        
        this.logger.info(`Moving to random spawn tile: (${x}, ${y})`);
        // Move to the random tile
        await this.goTo.execute(x, y);
        return !this.stopped;
    }
}

export { LookForParcelPlan };