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
        if (desires.length === 0) return;
        this.queue = desires.map(d => new IntentionDeliberation(d, this.beliefs, this.planner));
        this._revisePriorities();
    }

    /**
     * Checks if the highest priority intention has changed and re-prioritizes the queue.
     */
    _revisePriorities() {
        const newIntention = this.queue[0].desire;

        // Check if the intention is the same
        if (newIntention.type === this.currentIntention?.desire.type && newIntention.type === 'pickup' && newIntention.parcelId === this.currentIntention?.desire.parcelId) {
            this.beliefs.removeNeedToReconsider();
            return;
        }
        else if (newIntention.type === this.currentIntention?.desire.type && newIntention.type !== 'pickup') {
            this.beliefs.removeNeedToReconsider();
            return;
        }

        if (newIntention.priority > this.currentIntention?.desire.priority) {
            this.logger.debug("New highest priority:", newIntention.type, newIntention.priority);
            this.currentIntention?.stop();
        }
        this.beliefs.removeNeedToReconsider();
    }  

    getNextIntention() {
        const intention = this.queue.shift();
        if (intention && this.isValid(intention)) {
            this.logger.debug("Next intention:", intention.predicate);
            this.logger.debug("Other intentions:", this.queue.map(i => i.predicate));
        }
        return intention;
    }

    /**
     * Overrides the default isValid to check if the desire is still valid.
     */
    isValid(intention) {
        //const isReachable = Movement.isReachable(this.beliefs.config?.map, { x: this.beliefs.me.x, y: this.beliefs.me.y }, { x: intention.desire.x, y: intention.desire.y });
        const isReachable = true;
        // If the intention is not reachable, it's not valid.
        if (!isReachable) {
            this.logger.warn("Intention not reachable:", intention.predicate);
            return false;
        }

        // Example: Check if the parcel still exists and is not carried.
        if (intention.desire.type === 'pickup') {
            const parcel = this.beliefs.parcels.find(p => p.id === intention.desire.parcelId);
            this.logger.debug("Parcel still exists and is not carried:", parcel && !parcel.carriedBy);
            return parcel && !parcel.carriedBy;
        }
        // Check if we are still carrying some parcels.
        if (intention.desire.type === 'deliver') {
            this.logger.debug("We are still carrying some parcels:", this.beliefs.parcels.some(p => p.carriedBy === this.beliefs.me.id));
            return this.beliefs.parcels.some(p => p.carriedBy === this.beliefs.me.id);
        }
        return true;
    }
}

export { IntentionsRevise };