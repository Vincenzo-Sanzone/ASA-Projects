import { DjsClientSocket } from "@unitn-asa/deliveroo-js-sdk";
import { GameMap } from "./index.js";

class Movement {
    static #distanceCache = new Map();

    /**
     * 
     * @param {DjsClientSocket} socket - The socket connection. 
     */
    constructor(socket) {
        this.socket = socket;
    }

    /**
     * @param { {x: number, y:number} } start - Starting position of the agent.
     * @param { {x: number, y:number} } target - Target position to move to.
     */
    async moveTo(start, target) {
    }

    /**
     * Calculates the shortest distance (in terms of number of steps) between two points on the map, taking into account walls and directional arrows.
     * @param {GameMap} map - The game map containing the layout of tiles, walls, and directional arrows.
     * @param { {x: number, y:number} } start - Starting coordinates of the agent.
     * @param { {x: number, y:number} } target - Target coordinates to move to.
     * @returns {number} Shortest distance (in terms of number of steps) or `Infinity` if not reachable.
     */
    static getDistance(map, start, target) {
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
        if (map.tiles[start.y][start.x] === '0' || map.tiles[target.y][target.x] === '0') {
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

                const tile = map.tiles[newY][newX];
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

    static invalidateCache() {
        this.#distanceCache.clear();
    }
}

export { Movement };