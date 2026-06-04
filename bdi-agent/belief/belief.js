import { Logger, Agent, Parcel, GameConfig, Movement, Strategy } from "../../utility/index.js";

class Belief {
    constructor() {
        this.me = null;
        this.enemies = []; // List of other agents with their id, x, y, timestampSeen
        this.config = null;
        this.parcels = []; // List of parcels with their id, position, reward, carriedBy, timestampSeen
        this.isNeededReconsidering = false; // Flag to indicate if the belief needs to be reconsidered due to changes in the environment or new information received.

        this.logger = new Logger("Belief:");
    }

    /**
     * Update the belief about the agent itself.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOAgent} agent 
     */
    updateMe(agent) {
        // We are moving, so we don't save the last position
        if (agent.x % 1 !== 0 || agent.y % 1 !== 0) return;
        
        this.me = new Agent(agent, this.me);

        const deliveryPoints = Movement.getDeliveryPoints(this.config?.map);
        const didIMove = this.me.x !== this.me.last?.x || this.me.y !== this.me.last?.y;
        if (deliveryPoints.some(dp => dp.x === this.me.x && dp.y === this.me.y) && didIMove) {
            this.isNeededReconsidering = true;
        }

        this.updateRewardParcel();
    }

    /**
     * Function to update the belief about parcels based on the sensing data.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOParcel[]} parcels - Array of parcels received from sensing data.
     */
    updateParcel(parcels) {
        // For each parcel in the sensing data, check if it already exists in the belief. If it does, update its information; if not, add it to the belief.
        for (const sensedParcel of parcels) {
            const existingParcelIndex = this.parcels.findIndex(p => p.id === sensedParcel.id);
            const parcel = new Parcel(sensedParcel);
            if (existingParcelIndex !== -1) {
                // Update existing parcel information
                this.parcels[existingParcelIndex] = parcel;
            } else {
                // Add new parcel
                this.parcels.push(parcel);
                this.isNeededReconsidering = true; // If a new parcel is found, we may need to reconsider our intentions, as there may be new opportunities for pickup that were not previously known.
            }
        }
        // Remove non sensed parcels that i knew were there.
        const visibleIds = new Set(parcels.map(p => p.id));
        this.parcels = this.parcels.filter(parcel => {

            const dx = Math.abs(parcel.x - this.me.x);
            const dy = Math.abs(parcel.y - this.me.y);

            const isInView = dx + dy <= this.config?.observationDistance;

            // If the parcel is not visible, remove it
            return !(isInView && !visibleIds.has(parcel.id));
        });

        this.updateRewardParcel();
    }

    /**
     * Function to update the reward of each parcel based on the time since it was last seen.
     */
    updateRewardParcel() {
        const now = Date.now();
        this.parcels.forEach(parcel => {
            if (now - parcel.timestampSeen > Strategy.clockEventToMs(this.config.decayEvent)) {
                parcel.reward -= (now - parcel.timestampSeen) / Strategy.clockEventToMs(this.config.decayEvent);
                parcel.timestampSeen = now;
            }
        });
        // Delete parcels that have reward less than 1.
        this.parcels = this.parcels.filter(parcel => parcel.reward >= 1);
    }

    /**
     * Function to remove all parcels that are currently being carried by the agent.
     */
    removeCarriedParcel() {
        this.parcels = this.parcels.filter(parcel => parcel.carriedBy !== this.me.id);
    }

    /**
     * Update the belief about other agents based on the sensing data.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOAgent[]} agents - Array of agents received from sensing data. 
     */
    updateAgents(agents) {
        // Update the belief about other agents based on the sensing data. This can be implemented similarly to the updateParcel function, where we check if an agent already exists in the belief and update its information accordingly.
        for (const sensedAgent of agents) {
            // If the sensed agent is the same as "me", update the belief about "me" instead of adding it to the list of enemies.
            if (sensedAgent.id === this.me.id) {
                continue;
            }

            // Check if the agent already exists in the belief. If it does, update its information; if not, add it to the belief.
            const existingAgentIndex = this.enemies.findIndex(a => a.id === sensedAgent.id);
            if (existingAgentIndex !== -1) {
                // Update existing agent information
                const agent = new Agent(sensedAgent, this.enemies[existingAgentIndex]);
                this.enemies[existingAgentIndex] = agent;
            } else {
                const agent = new Agent(sensedAgent);
                // Add new agent
                this.enemies.push(agent);
            }
        }
    }


    updateConfig(config) {
        // Update the belief about the game configuration based on the configuration information received. This can involve updating properties such as clock, capacity, decayEvent, and generationEvent based on the config data.
        this.config = new GameConfig(config);
        this.logger.debug(`updated config information. New config: ${this.config}`);
    }

    removeNeedToReconsider() {
        this.isNeededReconsidering = false;
    }
}

export { Belief };