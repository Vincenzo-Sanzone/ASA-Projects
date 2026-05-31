import { IntentionDeliberation } from "./deliberation.js";
import { Intentions } from "./intention.js";
import { Movement, Logger } from "../../utility/index.js";

/**
 * Re-sorts the queue by priority every time a new intention is added.
 * Useful for agents that need to dynamically re-prioritize.
 */
class IntentionsRevise extends Intentions {
    constructor(beliefs, planner) {
        super(beliefs, planner);
        this.logger = new Logger("IntentionsRevise:");
    }

    /**
     * Adds new intentions to the queue.
     * @param {Array} desires - The desires to convert into intentions (e.g., [{ type: 'pickup', parcelId: 'p1', priority: 5 }]).
     */
    addIntentions(desires) {
        this.queue = desires.map(d => new IntentionDeliberation(d, this.beliefs, this.planner));        
    }

    /**
     * Re-sorts the queue based on the latest priorities.
     */
    _recalculatePriorities() {
        this.logger.info("Recalculating priorities...");
        this.queue.sort((a, b) => b.desire.priority - a.desire.priority);
    }

    getNextIntention() {
        return this.queue.shift();
    }

    /**
     * Overrides the default isValid to check if the desire is still valid.
     */
    isValid(intention) {
        //const isReachable = Movement.isReachable(this.beliefs.config?.map, { x: this.beliefs.me.x, y: this.beliefs.me.y }, { x: intention.desire.x, y: intention.desire.y });
        const isReachable = true;
        // If the intention is not reachable, it's not valid.
        if (!isReachable) {
            this.logger.log("Intention not reachable:", intention.predicate);
            return false;
        }

        // Example: Check if the parcel still exists and is not carried.
        if (intention.desire.type === 'pickup') {
            const parcel = this.beliefs.parcels.find(p => p.id === intention.desire.parcelId);
            this.logger.log("Parcel still exists and is not carried:", parcel && !parcel.carriedBy);
            return parcel && !parcel.carriedBy;
        }
        // Check if we are still carrying some parcels.
        if (intention.desire.type === 'deliver') {
            this.logger.log("We are still carrying some parcels:", this.beliefs.parcels.some(p => p.carriedBy === this.beliefs.me.id));
            return this.beliefs.parcels.some(p => p.carriedBy === this.beliefs.me.id);
        }
        return true;
    }
}

export { IntentionsRevise };