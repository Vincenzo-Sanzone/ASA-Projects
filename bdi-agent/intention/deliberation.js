import { Planner } from "../planner/planner.js";
import { Belief } from "../belief/belief.js";
import { Logger } from "../../utility/index.js";

/**
 * Represents a single intention with a plan to achieve it.
 */
class IntentionDeliberation {
    /**
     * @param {Object} desire - The desire this intention fulfills (e.g., { type: 'pickup', parcelId: 'p1', x: 5, y: 3 }).
     * @param {Belief} beliefs - Reference to the agent's beliefs.
     * @param {Planner} planner - Reference to the planner.
     */
    constructor(desire, beliefs, planner) {
        this.desire = desire;
        this.beliefs = beliefs;
        this.planner = planner;
        this.stopped = false;
        this.plan = null;

        this.logger = new Logger("IntentionDeliberation:");
        this.predicate = this._buildPredicate(desire);
    }

    /**
     * Converts a desire into a predicate (e.g., ['pickup', 5, 3, 'p1']).
     * @param {Object} desire - The desire object.
     * @returns {Array} The predicate array.
     */
    _buildPredicate(desire) {
        const predicate = [desire.type];
        if (desire.type === 'pickup' && desire.parcelId) {
            predicate.push(desire.parcelId);
        }
        return predicate;
    }

    /**
     * Executes the intention by finding and running a plan.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async achieve() {
        // 1. Find a plan for this intention.
        this.plan = this.planner.findPlan(this);
        if (!this.plan) {
            this.logger.error(`No plan found for intention: ${this.predicate.join(', ')}`);
            return false;
        }

        // 2. Execute the plan.
        try {
            this.logger.debug(`Executing plan for intention: ${this.predicate.join(', ')}`);
            const result = await this.plan.execute(...this.predicate.slice(1));
            return result;
        } catch (error) {
            this.logger.error(`Plan failed for intention ${this.predicate.join(', ')}:`, error);
            return false;
        }
    }

    /**
     * Stops the intention and its associated plan.
     */
    stop() {
        this.stopped = true;
        if (this.plan?.stop) {
            this.logger.debug(`Stopping plan for intention: ${this.predicate.join(', ')}`);
            this.plan.stop();
        }
    }
}

export { IntentionDeliberation };