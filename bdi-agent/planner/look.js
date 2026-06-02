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
        // Calculate best spawn tile to move
        const { x, y } = this.getBestSpawnTile();

        this.logger.info(`Moving to random spawn tile: (${x}, ${y})`);
        // Move to the random tile
        await this.goTo.execute(x, y);
        return !this.stopped;
    }

    /**
     * Choose the best spawn tile to move to based on a scoring system that considers both delivery potential and exploration potential.
     * @param {*} map - The map of the environment, used to calculate distances and identify walkable tiles. 
     * @returns 
     */
    getBestSpawnTile(walkableTiles) {
        const { map } = this.intention.beliefs.config;

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
        const { me } = this.intention.beliefs;

        const clustersRaw = Movement.getSpawnClusters(map, walkableTiles, 3);

        const clusters = clustersRaw.map(c =>this.analyzeCluster(map, c, me));

        let best = null;
        let bestScore = -Infinity;

        for (const c of clusters) {

            // Score based on delivery potential: how many parcels could be in this cluster and how close it is to delivery points
            const deliveryScore = this.scoreDelivery(c);

            // Score based on exploration potential: how many new tiles could we explore by going to this cluster and how far it is from other clusters (to maximize coverage)
            const explorationScore = this.scoreExploration(c,clustersRaw,map);

            const score = deliveryScore > -Infinity ? deliveryScore : explorationScore;

            this.logger.info(`Cluster with size ${c.size}, minDistanceToMe ${c.minDistanceToMe}, minDistanceToDelivery ${c.minDistanceToDelivery} has deliveryScore ${deliveryScore} and explorationScore ${explorationScore}, blended score: ${score}`);

            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }

        if (!best) return null;

        // entry tile
        let bestTile = null;
        let bestDist = Infinity;

        for (const t of best.cluster) {
            const d = Movement.getDistance(map, me, t);

            if (d < bestDist) {
                bestDist = d;
                bestTile = t;
            }
        }

        return bestTile;
    }

    analyzeCluster(map, cluster, me) {
        const distancesToMe = cluster.map(t =>
            Movement.getDistance(map, me, t)
        );

        const minDistanceToMe = Math.min(...distancesToMe);

        const nearestDeliveryDistances = cluster.map(t =>
            Movement.getDistance(
                map,
                t,
                Movement.nearestDeliveryPoint(map, t)
            )
        );

        const minDistanceToDelivery = Math.min(...nearestDeliveryDistances);

        return {
            cluster,
            size: cluster.length,
            minDistanceToMe,
            minDistanceToDelivery
        };
    }

    scoreDelivery(clusterInfo) {
        if (clusterInfo.minDistanceToMe <= 3)return -Infinity;

        return clusterInfo.size * 20 - clusterInfo.minDistanceToDelivery;
    }

    scoreExploration(clusterInfo, allClusters, map) {
        const distanceFromOtherClusters = allClusters
            .filter(c => c !== clusterInfo.cluster)
            .map(c =>
                Math.min(
                    ...c.map(t =>
                        Math.min(
                            ...clusterInfo.cluster.map(t2 =>
                                Movement.getDistance(map, t, t2)
                            )
                        )
                    )
                )
            );

        const minDistanceToOthers = Math.min(...distanceFromOtherClusters);

        return clusterInfo.size * 10 + minDistanceToOthers;
    }
}

export { LookForParcelPlan };