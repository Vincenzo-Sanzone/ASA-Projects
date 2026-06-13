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
        this.logger = new Logger("GoToPlan:");
        this.goToPddl = new GoToPddl(this.socket, this.intention);
        this.movement = new Movement(this.socket);
    }

    static isApplicable(action) {
        return false; // This plan is not directly applicable; it's used as a sub-plan.
    }

    stop() {
        super.stop();
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
        if (beliefs.crates.length === 0) await this.#moveWithAStar(beliefs, startX, startY, x, y);
        else await this.#moveWithPDDL(beliefs, startX, startY, x, y);

        return true;
    }

    async #moveWithAStar(beliefs, startX, startY, finalX, finalY) {
        let path = Movement.aStar(beliefs.config?.map, { x: startX, y: startY }, { x: finalX, y: finalY }, beliefs.enemies)?.slice(1);
        
        // Get start x and y as string
        let startXAsString = 'x' + startX.toString();
        let startYAsString = 'y' + startY.toString();
        for (const move of path) {
            const [x, y] = move.split(' ');
            if (startXAsString === x && startYAsString === y) {
                continue;
            }
            const replan = await this.movement.moveTo({ x: startXAsString, y: startYAsString }, { x, y }, this.intention.beliefs);
            if (this.stopped) return false;
            if (replan){ 
                path = Movement.aStar(beliefs.config?.map, { x: eval(startXAsString.slice(1)), y: eval(startYAsString.slice(1)) }, { x: finalX, y: finalY }, beliefs.enemies)?.slice(1);
            }
            startXAsString = x;
            startYAsString = y;
        }
    }

    async #moveWithPDDL(beliefs, startX, startY, x, y){
        this.goToPddl.addBelief(beliefs, { x: startX, y: startY });
        this.goToPddl.addGoal({ x, y });
        const plan = await this.goToPddl.solve();
        
        if (this.stopped) return false;
        await this.goToPddl.executePlan(plan);
    }
}

export { GoToPlan };