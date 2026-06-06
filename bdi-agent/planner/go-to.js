import { Logger, Movement } from "../../utility/index.js";
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
    }

    static isApplicable(action) {
        return false; // This plan is not directly applicable; it's used as a sub-plan.
    }

    stop() {
        super.stop();
        this.goToPddl.stop();
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

        const path = Movement.aStar(beliefs.config?.map, { x: startX, y: startY }, { x, y }, beliefs.enemies);

        const movement = new Movement(this.socket, this.intention.plan);

        // Get start x and y as string
        let startXAsString = 'x' + startX.toString();
        let startYAsString = 'y' + startY.toString();
        for (const move of path) {
            const [x, y] = move.split(' ');
            if (startXAsString === x && startYAsString === y) {
                continue;
            }
            await movement.moveTo({ x: startXAsString, y: startYAsString }, { x, y }, this.intention.beliefs);
            if (this.stopped) return false;
            startXAsString = x;
            startYAsString = y;
        }

    }

}

export { GoToPlan };