import { Plan, GoToPlan } from "./planner.js";

/**
 * Plan to look for new parcels by moving to a random walkable tile.
 * Useful when no parcels are visible.
 */
class LookForParcelPlan extends Plan {
    static isApplicable(action) {
        return action === 'lookForParcel';
    }

    async execute() {
        const { map } = this.intention.beliefs.config;
        const walkableTiles = [];

        // Collect all walkable tiles (non-walls, non-delivery points)
        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.width; y++) {
                const tile = map.tiles[x][y];
                if (tile !== '0' && tile !== '2') { // '0' = wall, '2' = delivery point
                    walkableTiles.push({ x, y });
                }
            }
        }

        if (walkableTiles.length === 0) {
            console.error("No walkable tiles found!");
            return false;
        }

        // Pick a random walkable tile
        const randomIndex = Math.floor(Math.random() * walkableTiles.length);
        const { x, y } = walkableTiles[randomIndex];
        
        console.log(`Moving to random walkable tile: (${x}, ${y})`);
        // Move to the random tile
        await new GoToPlan(this.intention, this.socket).execute(x, y);
        return !this.stopped;
    }
}

export { LookForParcelPlan };