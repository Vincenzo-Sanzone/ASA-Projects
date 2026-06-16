import { DjsClientSocket } from "@unitn-asa/deliveroo-js-sdk";
import { GameMap, Logger, executeUntilDone, Strategy } from "./index.js";
import { Belief } from "../bdi-agent/belief/belief.js";
class Movement {
    static #spawnClusterCache = null;
    /**
     * 
     * @param {DjsClientSocket} socket - The socket connection. 
     */
    constructor(socket) {
        this.socket = socket;
        this.stopped = false;
        this.logger = new Logger("Movement:", null)
    }

    stop() {
        this.logger.debug("Stopping movement...")
        this.stopped = true;
    }

    /**
     * @param { {x: string, y:string} } start - Starting position of the agent.
     * @param { {x: string, y:string} } target - Target position to move to.
     * @param {Belief} belief - The belief of the agent.
     * @returns true if a re plan is needed.
     */
    async moveTo(start, target, belief) {
        this.logger.agentName = belief.me.name
        while (belief.isNeededReconsidering || belief.waiting) { 
            if (this.stopped) return; 
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (this.stopped) return;
        const xStart = parseInt(start.x.toLowerCase().replace("x", ""));
        const yStart = parseInt(start.y.toLowerCase().replace("y", ""));
        const xTarget = parseInt(target.x.toLowerCase().replace("x", ""));
        const yTarget = parseInt(target.y.toLowerCase().replace("y", ""));

        this.logger.debug(`Moving from (x:${xStart}, y:${yStart}) to (x:${xTarget}, y:${yTarget})`);

        // Check if the start and target positions are the same
        if (xStart === xTarget && yStart === yTarget) {
            this.logger.debug("Start and target positions are the same")
            return;
        }

        let move = ""
        // Check if we have to move left
        if (xTarget < xStart) {
            this.logger.debug("Choosing left move")
            move = "left";
        }
        // Check if we have to move right
        if (xTarget > xStart) {
            this.logger.debug("Choosing right move")
            move = "right";
        }
        // Check if we have to move up
        if (yTarget > yStart) {
            this.logger.debug("Choosing up move")
            move = "up";
        }
        // Check if we have to move down
        if (yTarget < yStart) {
            this.logger.debug("Choosing down move")
            move = "down";
        }

        // Check if the move is valid, else wait for 1.5 seconds
        if (Strategy.isValidMove(belief.config?.map, { x: xStart, y: yStart }, { x: xTarget, y: yTarget }, belief)) {
            await this.#doMove(move, { x: xTarget, y: yTarget });
        } else {
            this.logger.info("Move is not valid, waiting 1.5 seconds");
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (this.stopped) return;
            if (Strategy.isValidMove(belief.config?.map, { x: xStart, y: yStart }, { x: xTarget, y: yTarget }, belief)) {
                await this.#doMove(move, { x: xTarget, y: yTarget });
            }
            else {
                this.stop();
                return true;
            }
        }
    }

    /**
     * Do the move, if the movement is not complete, it will stop.
     * @param {String} move - The move to make.
     * @param { {x: number, y:number} } param1 - The target position. 
     */
    async #doMove(move, { x, y }) {
        let finalX, finalY;
        var waitForCompleteMove = new Promise(res => this.socket.onYou(m => {
            finalX = m.x;
            finalY = m.y;
            m.x % 1 != 0 || m.y % 1 != 0 ? null : res();
        }));

        await executeUntilDone((...args) => this.socket.emitMove(...args), move);
        this.logger.debug(`Moved to (x:${finalX}, y:${finalY})`);
        await waitForCompleteMove
        this.logger.debug(`Arrived at (x:${finalX}, y:${finalY})`);

        if (finalX !== x || finalY !== y) {
            this.logger.info("We moved but didn't reach the target position");
            this.stop();
        }
    }

    /**
     * 
     * @param {GameMap} map 
     * @param {{x: number, y: number}} start 
     * @param {{x: number, y: number}} target 
     * @returns 
     */
    static aStar(map, start, target, enemies = []) {
        const width = map.width;
        const height = map.height;

        const key = (x, y) => `${x},${y}`;

        const heuristic = (x, y) => {
            // Manhattan distance (perfetta per griglia 4-direzioni)
            return Math.abs(x - target.x) + Math.abs(y - target.y);
        };

        const directions = [
            { dx: 0, dy: -1, forbiddenTile: '↑' },
            { dx: 0, dy: 1, forbiddenTile: '↓' },
            { dx: -1, dy: 0, forbiddenTile: '→' },
            { dx: 1, dy: 0, forbiddenTile: '←' }
        ];

        const openSet = new Set([key(start.x, start.y)]);
        const cameFrom = new Map();

        const gScore = new Map();
        const fScore = new Map();

        gScore.set(key(start.x, start.y), 0);
        fScore.set(key(start.x, start.y), heuristic(start.x, start.y));

        while (openSet.size > 0) {

            // trova nodo con fScore minimo
            let current = null;
            let bestF = Infinity;

            for (const k of openSet) {
                const f = fScore.get(k) ?? Infinity;
                if (f < bestF) {
                    bestF = f;
                    current = k;
                }
            }

            if (!current) break;
            
            const [cx, cy] = current.split(',').map(Number);

            if (cx === target.x && cy === target.y) {
                return this.#reconstructPath(cameFrom, current);
            }

            openSet.delete(current);

            const currentG = gScore.get(current);

            for (const { dx, dy, forbiddenTile } of directions) {

                const nx = cx + dx;
                const ny = cy + dy;
                const nKey = key(nx, ny);

                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                const tile = map.tiles[nx][ny];

                if (tile.toString() === '0') continue;
                if (enemies) {
                    let blocked = false;
                    for (const enemy of enemies) {
                        if (enemy.x % 1 !== 0 && (Math.floor(enemy.x) === nx || Math.ceil(enemy.x) === nx) && enemy.y === ny) blocked = true;
                        if (enemy.y % 1 !== 0 && (Math.floor(enemy.y) === ny || Math.ceil(enemy.y) === ny) && enemy.x === nx) blocked = true;
                        if (enemy.x === nx && enemy.y === ny) blocked = true;
                        if (blocked) break;
                    }
                    if (blocked) continue;
                }

                if (['↑', '↓', '→', '←'].includes(tile.toString()) && tile.toString() === forbiddenTile) continue;

                const tentativeG = currentG + 1;

                if (tentativeG < (gScore.get(nKey) ?? Infinity)) {

                    cameFrom.set(nKey, current);

                    gScore.set(nKey, tentativeG);
                    fScore.set(nKey, tentativeG + heuristic(nx, ny));

                    openSet.add(nKey);
                }
            }
        }

        return null;
    }

    static #reconstructPath(cameFrom, current) {
        const path = [current];

        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            path.push(current);
        }

        path.reverse()
        for (let i = 0; i < path.length; i++) {
            const [x, y] = path[i].split(',').map(Number);
            path[i] = `x${x} y${y}`;
        }
        return path;
    }

    static getDistance(map, start, target, enemies = []) {
        const path = this.aStar(map, start, target, enemies);
        return path ? path.length - 1 : Infinity;
    }

    /**
     * Calculates the shortest distance (in terms of number of steps) between two points on the map, taking into account walls and directional arrows.
     * @param {GameMap} map - The game map containing the layout of tiles, walls, and directional arrows.
     * @param { {x: number, y:number} } start - Starting coordinates of the agent.
     * @param { {x: number, y:number} } target - Target coordinates to move to.
     * @returns {boolean} `true` if reachable, `false` otherwise.
     */
    static isReachable(map, start, target, enemies = []) {
        // This method can be a simple wrapper around getDistance to check if the distance is finite.
        const distance = this.getDistance(map, start, target, enemies);
        return Number.isFinite(distance) && distance > 0;
    }

    /** 
     * Gives the coordinates of all the delivery points on the map.
     * @param {GameMap} map - The game map containing the layout of tiles, walls, and directional arrows.
     * @returns {Array} An array of objects representing the coordinates of the delivery points.
     */
    static getDeliveryPoints(map) {
        return map.tiles
            .flatMap((row, x) => row.map((v, y) => v?.toString() === '2' ? { x, y } : null))
            .filter(Boolean);
    }

    /**
     * Gets the coordinates of the nearest delivery point to the given coordinates.
     * @param {GameMap} map - The game map containing the layout of tiles, walls, and directional arrows.
     * @param {{x: number, y: number}} start - The coordinates of the agent.
     * @param {Array} enemies - An array of objects representing the coordinates of the enemies.
     * @param {Array} missionDelivery - An array of objects representing the coordinates of the mission delivery points.
     * @returns {{x: number, y: number, distance: number}} The coordinates of the nearest delivery point and its distance.
     */
    static nearestDeliveryPoint(map, start, enemies = [], missionDelivery = []) {

        const deliveryPoints = this.getDeliveryPoints(map);

        if (deliveryPoints.length === 0 && missionDelivery.length === 0) {
            return { distance: Infinity, x: null, y: null };
        }

        // Create a set of negative missions
        const forbidden = new Set(
            missionDelivery.filter(m => m.isNegative()).map(m => `${m.args.x},${m.args.y}`)
        );

        // Avoid negative missions
        const isForbidden = (x, y) => forbidden.has(`${x},${y}`);

        const positive = missionDelivery.filter(m => !m.isNegative());

        if (positive.length > 0) {
            const best = positive.reduce((nearest, mission) => {
                const { x, y } = mission.args;
                if (isForbidden(x, y)) return nearest;
                const distance = this.getDistance(map, start, mission.args, enemies);
                if (!Number.isFinite(distance)) return nearest;
                if (!nearest || distance < nearest.distance) {
                    return { distance, x, y };
                }
                return nearest;
            }, null);
            if (best) {
                return best;
            }
        }

        return deliveryPoints.reduce((nearest, point) => {
            if (isForbidden(point.x, point.y)) return nearest;
            const distance = this.getDistance(map, start, point, enemies);
            if (!Number.isFinite(distance)) return nearest;
            if (!nearest || distance < nearest.distance) {
                return { distance, x: point.x, y: point.y };
            }
            return nearest;
        }, null);
    }

    /**
     * 
     * @param {GameMap} map 
     * @returns 
     */
    static getSpawnPoints(map) {
        const spawnPoints = [];
        // Collect all spawn tiles
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const tile = map.tiles[x][y];
                if (tile.toString() === '1') {
                    spawnPoints.push({ x, y });
                }
            }
        }
        return spawnPoints;
    }

    static getSpawnClusters(map, spawnTiles, radius = 3) {
        // CACHE HIT
        if (this.#spawnClusterCache) {
            return this.#spawnClusterCache;
        }

        const clusters = [];
        const visited = new Set();
        const key = t => `${t.x},${t.y}`;

        for (const center of spawnTiles) {
            const centerKey = key(center);

            if (visited.has(centerKey))
                continue;

            const cluster = [];
            const queue = [center];

            visited.add(centerKey);

            while (queue.length) {
                const current = queue.shift();

                cluster.push(current);

                for (const other of spawnTiles) {
                    const otherKey = key(other);

                    if (visited.has(otherKey))
                        continue;

                    const d1 = Movement.getDistance(map, center, other);
                    const d2 = Movement.getDistance(map, other, center);

                    if (d1 <= radius && d2 <= radius) {
                        visited.add(otherKey);
                        queue.push(other);
                    }
                }
            }

            clusters.push(cluster);
        }

        // save cache
        this.#spawnClusterCache = clusters;

        return clusters;
    }


    static invalidateCache() {
        this.#spawnClusterCache = null;
    }
}

export { Movement };