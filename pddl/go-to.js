import { Movement } from "../utility/movement.js";
import { Pddl } from "./pddl.js";
import { GameMap } from "../utility/types.js";
import { Strategy } from "../utility/strategy.js";
import { IntentionDeliberation } from "../bdi-agent/intention/deliberation.js";

class GoToPddl extends Pddl {
    constructor(socket, intention) {
        super(socket, "go-to", intention);
        this.movement = new Movement(socket, this);
    }

    /**
     * Adds a goal to the PDDL problem. Subclasses must implement this method to define how the goal is added.
     * @param { {x: number, y: number} } position - The target position for the agent to go to.
     */
    addGoal(position) {
        this.goal = `and (agent x${position.x} y${position.y})`;
    }

    /**
     * Adds a belief to the belief set. Subclasses must implement this method to define how beliefs are added.
     * @param {GameMap} map - The game map to add to the belief set.
     * @param { {x: number, y: number} } me - The position of the agent.
     */
    async addBelief(map, me) {
        // Declare the position of the agent
        this.beliefset.declare(`agent x${me.x} y${me.y}`);        

        // Declare the position of the walls and left up tiles
        for (let y=0; y < map.height; y++) {
            for (let x=0; x < map.width; x++) {
                const value = map.tiles[x][y].toString();
                if (value === '0') {
                    this.beliefset.declare(`wall x${x} y${y}`);
                }
                else if (value === '←') {
                    this.beliefset.declare(`left-tile x${x} y${y}`);
                }
                else if (value === '↑') {
                    this.beliefset.declare(`up-tile x${x} y${y}`);
                }
                else if (value === '→') {
                    this.beliefset.declare(`right-tile x${x} y${y}`);
                }
                else if (value === '↓') {
                    this.beliefset.declare(`down-tile x${x} y${y}`);
                }


                if (y === 0 && x < map.width - 1) {
                    this.beliefset.declare(`left x${x} x${x + 1}`);
                }
            }

            if (y < map.height - 1) {
                this.beliefset.declare(`up y${y+1} y${y}`);
            }
        }
    }

    stop() {
        this.stopped = true;
        this.movement.stop();
    }

    /**
     * Adds all the actions to the PDDL executor.
     */
    addAllAction(belief) {
        this.executor.addAction(
            {
                name: "move-left",
                executor: (x1, x2, y) => { return this.movement.moveTo({ x: x1, y: y }, { x: x2, y: y }, belief) }
            },
            {
                name: "push-left",
                executor: (x1, x2, x3, y) => { return this.movement.moveTo({ x: x1, y: y }, { x: x2, y: y }, belief) }
            },
            {
                name: "move-right",
                executor: (x1, x2, y) => { return this.movement.moveTo({ x: x1, y: y }, { x: x2, y: y }, belief) }
            },
            {
                name: "push-right",
                executor: (x1, x2, x3, y) => { return this.movement.moveTo({ x: x1, y: y }, { x: x2, y: y }, belief) }
            },
            {
                name: "move-up",
                executor: (x, y1, y2) => { return this.movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }, belief) }
            },
            {
                name: "push-up",
                executor: (x, y1, y2, y3) => { return this.movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }, belief) }
            },
            {
                name: "move-down",
                executor: (x, y1, y2) => { return this.movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }, belief) }
            },
            {
                name: "push-down",
                executor: (x, y1, y2, y3) => { return this.movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }, belief) }
            },
        )
    }

    async populateCache(map) {
        this.logger.info('Populating cache...');
        const deliveryPoints = Movement.getDeliveryPoints(map);
        const spawnPoints = Movement.getSpawnPoints(map);
        // Start solving problems for all pairs of spawn and delivery points to populate the cache with useful plans that can be reused during the game.
        for (const delivery of deliveryPoints) {
            const spawn = Strategy.getBestSpawnTile(map, delivery);
            if (this.stopped) return;
            await this.addBelief(map, delivery);
            await this.addGoal(spawn);
            await this.solve();
            this.logger.info(`Solved problem from (${delivery.x}, ${delivery.y}) to (${spawn.x}, ${spawn.y})`);
        }
        
        for (const spawn of spawnPoints) {
            const nearest = Movement.nearestDeliveryPoint(map, spawn);
            if (this.stopped) return;
            await this.addBelief(map, spawn);
            await this.addGoal(nearest);
            await this.solve();

            const lookForParcel = Strategy.getBestSpawnTile(map, spawn);
            if (this.stopped) return;
            await this.addBelief(map, spawn);
            await this.addGoal(lookForParcel);
            await this.solve();
        }
    }

    
}

export { GoToPddl };