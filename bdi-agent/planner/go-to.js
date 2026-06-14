import { Logger, Movement, saveFile } from "../../utility/index.js";
import { Plan } from "./planner.js";
import { GoToPddl } from "../../pddl/go-to.js";

/**
 * Plan to move the agent to a specific (x, y) coordinate.
 * Used as a sub-plan by other plans (e.g., PickUpPlan, DeliverPlan).
 */
class GoToPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.logger = new Logger("GoToPlan:", intention.beliefs.me.name);
        this.goToPddl = new GoToPddl(this.socket, this.intention);
        this.movement = new Movement(this.socket);
    }

    static isApplicable(action) {
        return false; // This plan is not directly applicable; it's used as a sub-plan.
    }

    stop() {
        super.stop();
        this.stopped = true;
        this.goToPddl.stop();
        this.movement.stop();
    }

    async execute(x, y) {
        this.logger.debug(`Moving to (${x}, ${y})`);
        const { beliefs } = this.intention;

        const startX = beliefs.me.x;
        const startY = beliefs.me.y;

        // Avoid infinite loops if already at the target
        if (startX === x && startY === y) {
            return true;
        }

        // If the map has no crates, use A*, else use PDDL
        if (beliefs.crates.length === 0) return await this.#moveWithAStar(beliefs, startX, startY, x, y);
        else return await this.#moveWithPDDL(beliefs, startX, startY, x, y);
    }

    async #moveWithAStar(beliefs, startX, startY, finalX, finalY) {
        let path = Movement.aStar(beliefs.config?.map, { x: startX, y: startY }, { x: finalX, y: finalY }, beliefs.enemies)?.slice(1);
        
        // TODO che si fa??
        if (!path) {
            console.log("[DEBUG] No path found", this.intention.beliefs.me.name);
            return false;
        }

        // Get start x and y as string
        let startXAsString = 'x' + startX.toString();
        let startYAsString = 'y' + startY.toString();
        for (const move of path) {
            const [x, y] = move.split(' ');
            if (startXAsString === x && startYAsString === y) {
                continue;
            }
            const replan = await this.movement.moveTo({ x: startXAsString, y: startYAsString }, { x, y }, this.intention.beliefs);
            this.logger.debug("Movement completed")
            if (this.stopped) {
                this.logger.debug("I am stopped")
                return false;
            }
            if (replan){ 
                path = Movement.aStar(beliefs.config?.map, { x: eval(startXAsString.slice(1)), y: eval(startYAsString.slice(1)) }, { x: finalX, y: finalY }, beliefs.enemies)?.slice(1);
                // TODO CHE si fa??
                if (!path) {
                    console.log("[DEBUG] No path found on replan", this.intention.beliefs.me.name);
                    return false;
                }
            }
            startXAsString = x;
            startYAsString = y;
        }
        this.logger.debug("Reached final position");
        return true;
    }

    async #moveWithPDDL(beliefs, startX, startY, x, y){
        this.goToPddl.addBelief(beliefs, { x: startX, y: startY });
        this.goToPddl.addGoal({ x, y });
        const plan = await this.goToPddl.solve();
        
        if (this.stopped) return false;
        return await this.goToPddl.executePlan(plan);
    }
}

export { GoToPlan };