import { DjsClientSocket } from "@unitn-asa/deliveroo-js-sdk";
import { IntentionDeliberation } from "../intention/deliberation.js";
import { GoToPddl } from "../../pddl/go-to.js";
import { Logger } from "../../utility/index.js";
/**
 * Planner class: Finds and manages plans to achieve intentions.
 * Uses a library of plan classes (e.g., GoToPlan, PickUpPlan) to match intentions to actions.
 */
class Planner {
    /**
     * @param {DjsClientSocket} socket - The socket instance for game actions (e.g., emitMoveTowards, emitPickUp).
     */
    constructor(socket) {
        this.socket = socket;
        // Library of all available plans
        this.planLibrary = [];
        this.logger = new Logger("Planner:");
    }

    /**
     * Registers a new plan class.
     * @param {typeof Plan} planClass - The plan class to register.
     */
    registerPlan(planClass) {
        this.planLibrary.push(planClass);
        this.logger.info(`Registered plan: ${planClass.name}`);
    }

    /**
     * Finds a plan that can achieve the given intention.
     * @param {IntentionDeliberation} intention - The intention to find a plan for.
     * @returns {Plan|null} A plan instance, or null if no applicable plan is found.
     */
    findPlan(intention) {
        const [action, x, y, id, deliveryId] = intention.predicate;

        for (const PlanClass of this.planLibrary) {
            if (PlanClass.isApplicable(action, x, y, id, deliveryId)) {
                this.logger.info(`Found plan: ${PlanClass.name}`);
                return new PlanClass(intention, this.socket);
            }
        }

        this.logger.error(`No plan found for intention: ${intention.predicate.join(', ')}`);
        return null;
    }
}

/**
 * Base class for all plans. Subclasses must implement:
 * - `static isApplicable(action, ...args)`
 * - `async execute(...args)`
 * - `stop()`
 */
class Plan {
    /**
     * @param {IntentionDeliberation} intention - The intention this plan will fulfill.
     * @param {DjsClientSocket} socket - The socket instance for game actions.
     */
    constructor(intention, socket) {
        this.intention = intention;
        this.socket = socket;
        this.stopped = false;
        this.logger = new Logger("Plan:");
    }

    /**
     * Checks if this plan can handle the given action.
     * @param {string} action - The action type (e.g., 'pickup', 'deliver').
     * @param {...any} args - Additional arguments (e.g., x, y, id).
     * @returns {boolean} True if applicable.
     */
    static isApplicable(action, ...args) {
        throw new Error("Method 'isApplicable()' must be implemented by subclasses.");
    }

    /**
     * Executes the plan.
     * @param {...any} args - Arguments for the plan (e.g., x, y, id).
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async execute(...args) {
        throw new Error("Method 'execute()' must be implemented by subclasses.");
    }

    /**
     * Stops the plan.
     */
    stop() {this.stopped = true;}
}

/**
 * Plan to move the agent to a specific (x, y) coordinate.
 * Used as a sub-plan by other plans (e.g., PickUpPlan, DeliverPlan).
 */
class GoToPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.logger = new Logger("GoToPlan:");
    }

    static isApplicable(action) {
        return false; // This plan is not directly applicable; it's used as a sub-plan.
    }

    async execute(x, y) {
        this.logger.info(`Moving to (${x}, ${y})`);
        const { beliefs } = this.intention;
        
        const startX = beliefs.me.x;
        const startY = beliefs.me.y;

        // Avoid infinite loops if already at the target
        if (startX === x && startY === y) {
            return true;
        }
        
        this.logger.info(`Adding information to the PDDL to solve move from ${startX},${startY} to ${x},${y}`)
        const goToPddl = new GoToPddl(this.socket);
        await goToPddl.addBelief(beliefs);
        await goToPddl.addGoal({ x, y });
        const plan = await goToPddl.solve();
        if (!plan) {
            this.logger.error(`No plan found to go to (${x}, ${y})`);
            return false;
        }

        this.logger.info("Executing plan")
        await goToPddl.executePlan(plan);
        return !this.stopped;
    }
}


export {
    Planner,
    Plan,
    GoToPlan
};