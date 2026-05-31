import { Movement } from "../utility/movement.js";
import { Pddl } from "./pddl.js";
import { Belief } from "../bdi-agent/belief/belief.js";

class GoToPddl extends Pddl {
    constructor(socket) {
        super(socket, "go-to");
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
     * @param {Belief} belief - The belief to add to the belief set.
     */
    async addBelief(belief) {
        // Declare the position of the agent
        this.beliefset.declare(`agent x${belief.me.x} y${belief.me.y}`);

        // Declare the position of the other agents ad walls
        

        // Declare the position of the walls and left up tiles
        for (let x=0; x < belief.config.map.width; x++) {
            for (let y=0; y < belief.config.map.height; y++) {
                if (belief.config.map.tiles[x][y].toString() === '0') {
                    this.beliefset.declare(`wall x${x} y${y}`);
                }

                if (x === 0 && y < belief.config.map.height - 1) {
                    this.beliefset.declare(`up y${y+1} y${y}`);
                }
            }

            if (x < belief.config.map.width - 1) {
                this.beliefset.declare(`left x${x} x${x + 1}`);
            }
        }
    }

    /**
     * Adds all the actions to the PDDL executor.
     */
    addAllAction() {
        const movement = new Movement(this.socket);
        this.executor.addAction(
            {
                name: "move-left",
                executor: (x1, x2, y) => { return movement.moveTo({ x: x1, y: y }, { x: x2, y: y }) }
            },
            {
                name: "push-left",
                executor: (x1, x2, x3, y) => { return movement.moveTo({ x: x1, y: y }, { x: x2, y: y }) }
            },
            {
                name: "move-right",
                executor: (x1, x2, y) => { return movement.moveTo({ x: x1, y: y }, { x: x2, y: y }) }
            },
            {
                name: "push-right",
                executor: (x1, x2, x3, y) => { return movement.moveTo({ x: x1, y: y }, { x: x2, y: y }) }
            },
            {
                name: "move-up",
                executor: (x, y1, y2) => { return movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }) }
            },
            {
                name: "push-up",
                executor: (x, y1, y2, y3) => { return movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }) }
            },
            {
                name: "move-down",
                executor: (x, y1, y2) => { return movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }) }
            },
            {
                name: "push-down",
                executor: (x, y1, y2, y3) => { return movement.moveTo({ x: x, y: y1 }, { x: x, y: y2 }) }
            },
        )
    }
}

export { GoToPddl };