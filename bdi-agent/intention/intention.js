import { Planner } from "../planner/planner.js";
import { Belief } from "../belief/belief.js";
import { IntentionDeliberation } from "./deliberation.js";
import { Logger } from "../../utility/index.js";

/**
 * Base class for managing and executing intentions.
 * Uses the Strategy Pattern to support different intention selection policies.
 */
class Intentions {
    /**
     * @param {Belief} beliefs - Reference to the agent's beliefs.
     * @param {Planner} planner - Reference to the planner (finds applicable plans).
     */
    constructor(beliefs, planner) {
        this.beliefs = beliefs;
        this.planner = planner;
        this.queue = [];          // Queue of pending intentions.
        this.currentIntention = null; // Currently executing intention.
        this.stopped = false;     // Flag to stop the loop.

        this.logger = new Logger("Intentions:");
    }

    /**
     * Adds a new intention to the queue.
     * @param {Object} desires - The desires to convert into intentions (e.g., [{ type: 'pickup', parcelId: 'p1', priority: 5 }]).
     */
    addIntentions(desires) {
        throw new Error("Method 'addIntentions()' must be implemented by subclasses.");
    }

    /**
     * Gets the next intention to execute.
     * @returns {IntentionDeliberation|null} The next intention, or null if the queue is empty.
     */
    getNextIntention() {
        throw new Error("Method 'getNextIntention()' must be implemented by subclasses.");
    }

    /**
     * Checks if an intention is still valid (e.g., the target parcel still exists).
     * @param {IntentionDeliberation} intention - The intention to validate.
     * @returns {boolean} True if valid, false otherwise.
     */
    isValid(intention) {
        throw new Error("Method 'isValid()' must be implemented by subclasses.");
    }

    /**
     * Stops the current intention and clears the queue.
     */
    stop() {
        this.logger.log("Stopping intentions...");
        this.stopped = true;
        if (this.currentIntention) {
            this.currentIntention.stop();
        }
        this.queue = [];
    }

    /**
     * Main loop for executing intentions.
     * Runs indefinitely until stopped.
     */
    async loop() {
        while (!this.stopped) {
            // 1. Get the next intention.
            const intention = this.getNextIntention();
            if (!intention) {
                // No intentions to execute: wait for the next event.
                await new Promise(res => setImmediate(res));
                continue;
            }
            this.logger.log("Next intention:", intention.predicate);
            // 2. Check if the intention is still valid.
            if (!this.isValid(intention)) {
                this.logger.log("Intention no longer valid:", intention.predicate);
                continue;
            }

            // 3. Execute the intention.
            this.currentIntention = intention;
            try {
                this.logger.log("Executing intention:", intention.predicate);
                await intention.achieve();
                this.logger.log("Intention completed:", intention.predicate);
            } catch (error) {
                this.logger.error("Intention failed:", intention.predicate, error);
            } finally {
                this.currentIntention = null;
            }

            // 4. Wait for the next tick (to avoid blocking the event loop).
            await new Promise(res => setImmediate(res));
        }
    }
}

export {
    Intentions
};