import { GameMap, Movement } from "./index.js";
import { Belief } from "../bdi-agent/belief/belief.js";

class Strategy {

    /**
     * Choose the best spawn tile to move to based on a scoring system that considers both delivery potential and exploration potential.
     * @param {GameMap} map - The map of the environment, used to calculate distances and identify walkable tiles.
     * @param { {x: number, y:number} } me - The agent's current position on the map. 
     * @returns 
     */
    static getBestSpawnTile(map, me) {
        const spawnTiles = Movement.getSpawnPoints(map);

        if (spawnTiles.length === 0) return false;
        
        const clustersRaw = Movement.getSpawnClusters(map, spawnTiles, 3);

        const clusters = clustersRaw.map(c =>Strategy.#analyzeCluster(map, c, me));

        let best = clusters[0];
        let bestScore = -Infinity;

        for (const cluster of clusters) {

            // Score based on delivery potential: how many parcels could be in this cluster and how close it is to delivery points
            const deliveryScore = Strategy.#scoreDelivery(cluster);

            // Score based on exploration potential: how many new tiles could we explore by going to this cluster and how far it is from other clusters (to maximize coverage)
            const explorationScore = Strategy.#scoreExploration(cluster,clustersRaw,map);

            const score = deliveryScore > -Infinity ? deliveryScore : explorationScore;

            if (score > bestScore) {
                bestScore = score;
                best = cluster;
            }
        }

        if (!best) return null;

        // entry tile
        let bestTile = null;
        let bestDist = Infinity;

        for (const tile of best.cluster) {
            const distance = Movement.getDistance(map, me, tile);

            if (distance < bestDist) {
                bestDist = distance;
                bestTile = tile;
            }
        }

        return bestTile;
    }

    /**
     * 
     * @param {GameMap} map - The map
     * @param {{x: number, y: number}} start - The starting position
     * @param {{x: number, y: number}} target - The target position 
     * @param {Belief} belief - The agent's belief
     */
    static isValidMove(map, start, target, belief) {
        if (!Movement.isReachable(map, start, target)) return false;
        
        for (const enemy of belief.enemies) {
            if (target.x === enemy.x && target.y === enemy.y) return false;
        }

        return true;
    }

    static #analyzeCluster(map, cluster, me) {
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

    static #scoreDelivery(clusterInfo) {
        if (clusterInfo.minDistanceToMe <= 3) return -Infinity;

        return clusterInfo.size * 20 - clusterInfo.minDistanceToDelivery;
    }

    static #scoreExploration(clusterInfo, allClusters, map) {
        if (clusterInfo.minDistanceToMe <= 3) return -Infinity
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

    /**
     * Converts a clock event to milliseconds.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOClockEvent | undefined} event - Es: '1s', 'frame', 'infinite'
     * @returns {number} Time in milliseconds
     */
    static clockEventToMs(event) {
        switch (event) {
            case 'frame': return 50;     // 1 frame ≈ 50ms (1/20 di secondo, basato su CLOCK: 50)
            case '1s': return 1000;
            case '2s': return 2000;
            case '5s': return 5000;
            case '10s': return 10000;
            case 'infinite': return Infinity;
            default: return Infinity; // Valore sconosciuto
        }
    }
}

export {Strategy};