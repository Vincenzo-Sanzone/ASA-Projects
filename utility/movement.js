import { DjsClientSocket } from "@unitn-asa/deliveroo-js-sdk";
import { GameMap, Logger } from "./index.js";

class Movement {
    static #distanceCache = new Map();

    /**
     * 
     * @param {DjsClientSocket} socket - The socket connection. 
     */
    constructor(socket) {
        this.socket = socket;
        this.logger = new Logger("Movement:") 
    }

    /**
     * @param { {x: string, y:string} } start - Starting position of the agent.
     * @param { {x: string, y:string} } target - Target position to move to.
     */
    async moveTo(start, target) {
        const xStart = parseInt(start.x.toLowerCase().replace("x", ""));
        const yStart = parseInt(start.y.toLowerCase().replace("y", ""));
        const xTarget = parseInt(target.x.toLowerCase().replace("x", ""));
        const yTarget = parseInt(target.y.toLowerCase().replace("y", ""));

        this.logger.info(`Moving from (x:${xStart}, y:${yStart}) to (x:${xTarget}, y:${yTarget})`);

        // Check if the start and target positions are the same
        if (xStart === xTarget && yStart === yTarget ) {
            this.logger.debug("Start and target positions are the same")
            return;
        }

        var waitForCompleteMove = new Promise( res => this.socket.onYou( m => m.x % 1 != 0 || m.y % 1 != 0 ? null : res() ) );

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
        
        await this.socket.emitMove(move);

        await waitForCompleteMove
    }

    /**
     * Calculates the shortest distance (in terms of number of steps) between two points on the map, taking into account walls and directional arrows.
     * @param {GameMap} map - The game map containing the layout of tiles, walls, and directional arrows.
     * @param { {x: number, y:number} } start - Starting coordinates of the agent.
     * @param { {x: number, y:number} } target - Target coordinates to move to.
     * @returns {number} Shortest distance (in terms of number of steps) or `Infinity` if not reachable.
     */
    static getDistance(map, start, target) {
        if (start.x % 1 != 0 || start.y % 1 != 0 || target.x % 1 != 0 || target.y % 1 != 0) {
            return Infinity;
        }
        const height = map.height;
        const width = map.width;
        const cacheKey = `${start.x},${start.y}-${target.x},${target.y}`;
        if (this.#distanceCache.has(cacheKey)) {
            return this.#distanceCache.get(cacheKey);
        }

        // Check if start and target are within the map boundaries
        if (
            start.x < 0 || start.x >= width || start.y < 0 || start.y >= height ||
            target.x < 0 || target.x >= width || target.y < 0 || target.y >= height
        ) {
            return Infinity;
        }
        
        // Check if start or target are walls
        if (map.tiles[start.x][start.y] === '0' || map.tiles[target.x][target.y] === '0') {
            return Infinity;
        }

        // Define possible movements and their required tile types (for directional arrows)
        const directions = [
            { dx: 0, dy: -1, requiredTile: '↑' }, // Up: the destination cell (y-1) must be '↑'
            { dx: 0, dy: 1, requiredTile: '↓' }, // Down: the destination cell (y+1) must be '↓'
            { dx: 1, dy: 0, requiredTile: '→' }, // Right: the destination cell (x+1) must be '→'
            { dx: -1, dy: 0, requiredTile: '←' }  // Left: the destination cell (x-1) must be '←'
        ];

        // Apply BFS to find the shortest path from start to target
        const queue = [{ x: start.x, y: start.y, steps: 0 }];
        const visited = new Set([`${start.x},${start.y}`]);

        while (queue.length > 0) {
            const { x, y, steps } = queue.shift();

            // We reached the target
            if (x === target.x && y === target.y) {
                this.#distanceCache.set(cacheKey, steps);
                return steps;
            }

            // Explore neighbors
            for (const { dx, dy, requiredTile } of directions) {
                const newX = x + dx;
                const newY = y + dy;
                const key = `${newX},${newY}`;

                // Skip if out of bounds or already visited
                if (
                    newX < 0 || newX >= width ||
                    newY < 0 || newY >= height ||
                    visited.has(key)
                ) {
                    continue;
                }

                const tile = map.tiles[newX][newY];
                // Check if the tile is a wall
                if (tile.toString() === '0') {
                    continue;
                }

                // Check if the tile is a directional arrow that does not allow movement in the intended direction
                if (['↑', '↓', '→', '←'].includes(tile.toString()) && tile.toString() !== requiredTile) {
                    continue;
                }

                // Mark the new position as visited and add it to the queue
                visited.add(key);
                queue.push({ x: newX, y: newY, steps: steps + 1 });
            }
        }

        // If we exhaust the queue without reaching the target, it means it's not reachable
        this.#distanceCache.set(cacheKey, Infinity);
        return Infinity;
    }

    /**
     * Calculates the shortest distance (in terms of number of steps) between two points on the map, taking into account walls and directional arrows.
     * @param {GameMap} map - The game map containing the layout of tiles, walls, and directional arrows.
     * @param { {x: number, y:number} } start - Starting coordinates of the agent.
     * @param { {x: number, y:number} } target - Target coordinates to move to.
     * @returns {boolean} `true` if reachable, `false` otherwise.
     */
    static isReachable(map, start, target) {
        // This method can be a simple wrapper around getDistance to check if the distance is finite.
        const distance = this.getDistance(map, start, target);
        return distance !== Infinity;
    }
    static invalidateCache() {
        this.#distanceCache.clear();
    }
}

export { Movement };