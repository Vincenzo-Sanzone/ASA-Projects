import { Movement } from "../utility/movement.js";
import { Pddl } from "./pddl.js";
import { GameMap } from "../utility/types.js";
import { Strategy } from "../utility/strategy.js";
import { IntentionDeliberation } from "../bdi-agent/intention/deliberation.js";
import { Belief } from "../bdi-agent/belief/belief.js";

class DeliveryCollaboration extends Pddl {
    constructor() {
        super(null, "delivery-collaboration");
    }

    /**
     * Adds a goal to the PDDL problem. Subclasses must implement this method to define how the goal is added.
     */
    addGoal() {
        this.goal = `or (solved a1) (solved a2)`;
    }

    /**
     * Adds a belief to the belief set. Subclasses must implement this method to define how beliefs are added.
     * @param {Belief} belief - The game map to add to the belief set.
     * @param { {x: number, y: number} } bdi - The position of the bdi agent.
     * @param { {x: number, y: number} } llm - The position of the llm agent.
     */
    addBelief(belief, bdi, llm) {
        const map = belief.config.map
        // Declare the position of the agent
        this.beliefset.declare(`agent a1`);
        this.beliefset.declare(`agent a2`);
        this.beliefset.declare(`at a1 x${bdi.x} y${bdi.y}`);    
        this.beliefset.declare(`at a2 x${llm.x} y${llm.y}`);  
        this.beliefset.declare(`wall x${llm.x} y${llm.y}`);
        this.beliefset.declare(`wall x${bdi.x} y${bdi.y}`);  

        // Declare the position of the crates
        for (const crate of belief.crates) {
            this.beliefset.declare(`crate x${crate.x} y${crate.y}`);
        }

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
                else if (value === '5' || value === '5!') {
                    this.beliefset.declare(`can-be-crate x${x} y${y}`);
                }
                else if (value === '1') {
                    this.beliefset.declare(`spawn x${x} y${y}`);
                }
                else if (value === '2') {
                    this.beliefset.declare(`delivery x${x} y${y}`);
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
}

export { DeliveryCollaboration };