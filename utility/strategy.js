import { GameMap, Movement } from "./index.js";
import { Belief } from "../bdi-agent/belief/belief.js";

class Strategy {

    static getDeliveryWithCoordinate(map, me, args = {}) {
        if (args.x === null || args.y === null) return null;

        const isX = args.x !== null

        if (isX) {
            for (let y = 0; y < map.height; y++) {
                if (map.tiles[args.x][y] === '1') {
                    return { x: args.x, y };
                }
            }
            // We could not find a delivery point with the given coordinates, so we return the nearest tile with the coordinate x
            let bestDist = Infinity;
            let bestTile = null;
            for (let y = 0; y < map.height; y++) {
                if (map.tiles[args.x][y] !== '0') {
                    const distance = Movement.getDistance(map, me, { x: args.x, y });
                    if (distance < bestDist) {
                        bestDist = distance;
                        bestTile = { x: args.x, y };
                    }
                }
            }
            return bestTile;
        }
        else {
            for (let x = 0; x < map.width; x++) {
                if (map.tiles[x][args.y] === '1') {
                    return { x, y: args.y };
                }
            }
            // We could not find a delivery point with the given coordinates, so we return the nearest tile with the coordinate y
            let bestDist = Infinity;
            let bestTile = null;
            for (let x = 0; x < map.width; x++) {
                if (map.tiles[x][args.y] !== '0') {
                    const distance = Movement.getDistance(map, me, { x, y: args.y });
                    if (distance < bestDist) {
                        bestDist = distance;
                        bestTile = { x, y: args.y };
                    }
                }
            }
            return bestTile;
        }
    }

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

        const clusters = clustersRaw.map(c => Strategy.#analyzeCluster(map, c, me));

        let best = clusters[0];
        let bestScore = -Infinity;

        for (const cluster of clusters) {

            // Score based on delivery potential: how many parcels could be in this cluster and how close it is to delivery points
            const deliveryScore = Strategy.#scoreDelivery(cluster);

            // Score based on exploration potential: how many new tiles could we explore by going to this cluster and how far it is from other clusters (to maximize coverage)
            const explorationScore = Strategy.#scoreExploration(cluster, clustersRaw, map);

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

    /**
     * 
     * @param {GameMap} map 
     * @param {{x: number, y: number}} target 
     * @param {number} maxDistance 
     */
    static getAllPossibleTiles(map, target, maxDistance) {
        const possibleTiles = [];

        for (let x = target.x - maxDistance; x <= target.x + maxDistance && x < map.width && x >= 0; x++) {
            for (let y = target.y - maxDistance; y <= target.y + maxDistance && y < map.height && y >= 0; y++) {

                const dx = Math.abs(x - target.x);
                const dy = Math.abs(y - target.y);

                // Manhattan distance constraint
                if (dx + dy <= maxDistance) {
                    if (map.tiles[x][y].toString() !== '0') {
                        possibleTiles.push({ x, y });
                    }
                }
            }
        }

        return possibleTiles;
    }

    /**
     * 
     * @param {GameMap} map 
     * @param {{x: number, y: number}} me 
     * @param {boolean} isXOdd 
     * @param {boolean} isYOdd 
     * @param {Array} enemies
     */
    static findTileWith(map, me, isXOdd, isYOdd, enemies) {
        let bestTile = null;
        let bestDistance = Infinity;

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];
                if (!tile) continue;

                const x = tile.x;
                const y = tile.y;

                // X filter
                if (isXOdd !== null) {
                    const isOdd = x % 2 === 1;
                    if (isOdd !== isXOdd) continue;
                }

                // Y filter
                if (isYOdd !== null) {
                    const isOdd = y % 2 === 1;
                    if (isOdd !== isYOdd) continue;
                }

                const dist = Movement.getDistance(map, me, tile, enemies);

                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestTile = tile;
                }
            }
        }

        return bestTile;
    }

    /**
    * Find the nearest tile that has at least 2 bidirectional neighbours.
    *
    * @param {GameMap} map
    * @param {{x:number,y:number}} me
    * @param {Array} enemies
    * @returns {{x:number,y:number}|null}
    */
    static findTileAccessible(map, me, enemies = []) {
        const directions = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0]
        ];

        let bestTile = null;
        let bestDistance = Infinity;

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {

                const tile = map.tiles[x][y];

                if (!tile || tile.toString() === '0') continue;

                let bidirectionalNeighbours = 0;

                for (const [dx, dy] of directions) {

                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;

                    const neighbour = map.tiles[nx][ny];

                    if (!neighbour || neighbour.toString() === '0') continue;

                    const forward = Movement.getDistance(map, { x, y }, { x: nx, y: ny }, enemies);

                    const backward = Movement.getDistance(map, { x: nx, y: ny }, { x, y }, enemies);

                    if (forward === 1 && backward === 1) bidirectionalNeighbours++;
                }

                if (bidirectionalNeighbours < 2) continue;

                const distanceFromMe = Movement.getDistance(
                    map,
                    me,
                    { x, y },
                    enemies
                );

                if (!Number.isFinite(distanceFromMe)) continue;

                if (distanceFromMe < bestDistance) {
                    bestDistance = distanceFromMe;
                    bestTile = { x, y };
                }
            }
        }

        return bestTile;
    }

    /**
     * Find the nearest tile to me that has distance 1 from the target (bidirectional).
     * @param {GameMap} map 
     * @param {{x: number, y: number}} me 
     * @param {{x: number, y: number}} target 
     * @param {Array} enemies 
     */
    static findNearest(map, me, target, enemies) {
        const directions = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0]
        ];

        let bestTile = null;
        let bestDistance = Infinity;

        for (const [dx, dy] of directions) {

            const x = target.x + dx;
            const y = target.y + dy;

            if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;

            const tile = map.tiles[x][y];

            if (!tile || tile.toString() === '0') continue;

            // candidate -> target
            const forward = Movement.getDistance(map, { x, y }, target);

            // target -> candidate
            const backward = Movement.getDistance(map, target, { x, y });

            if (forward !== 1 || backward !== 1) continue;

            const distanceFromMe = Movement.getDistance(map, me, { x, y }, enemies);

            if (!Number.isFinite(distanceFromMe)) continue;

            if (distanceFromMe < bestDistance) {
                bestDistance = distanceFromMe;
                bestTile = { x, y };
            }
        }

        return bestTile;
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

export { Strategy };