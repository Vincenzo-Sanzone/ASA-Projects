import { Agent, Parcel, GameConfig } from "../../utility/types.js";
import { Logger } from "../../utility/index.js";

class Belief {
    constructor() {
        this.me = null;
        this.enemies = []; // List of other agents with their id, x, y, timestampSeen
        this.config = null;
        this.parcels = []; // List of parcels with their id, position, reward, carriedBy, timestampSeen

        this.logger = new Logger("Belief:");
    }

    /**
     * Update the belief about the agent itself.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOAgent} agent 
     */
    updateMe ( agent ) {
        this.me = new Agent(agent);
        this.logger.debug(`updated agent information. New position ${this.me.x}, ${this.me.y}`);
    }

    /**
     * Function to update the belief about parcels based on the sensing data.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOParcel[]} parcels - Array of parcels received from sensing data.
     */
    updateParcel (parcels) {
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
            }
        }

        // Delete parcels that have reward 1 and are not seen in the current sensing data, as they are likely to have been decayed and removed from the game. 
        this.parcels = this.parcels.filter(parcel => parcel.reward !== 1);

        this.logger.debug(`updated parcel information. New parcels: ${this.parcels.length}, ${this.parcels.map(p => {p.id, p.x, p.y})}`);
    }

    /**
     * Update the belief about other agents based on the sensing data.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOAgent[]} agents - Array of agents received from sensing data. 
     */
    updateAgents (agents) {
        // Update the belief about other agents based on the sensing data. This can be implemented similarly to the updateParcel function, where we check if an agent already exists in the belief and update its information accordingly.
        for (const sensedAgent of agents) {
            // If the sensed agent is the same as "me", update the belief about "me" instead of adding it to the list of enemies.
            if (sensedAgent.id === this.me.id) {
                continue;
            }

            // Check if the agent already exists in the belief. If it does, update its information; if not, add it to the belief.
            const existingAgentIndex = this.enemies.findIndex(a => a.id === sensedAgent.id);
            const agent = new Agent(sensedAgent);
            if (existingAgentIndex !== -1) {
                // Update existing agent information
                this.enemies[existingAgentIndex] = agent;
            } else {
                // Add new agent
                this.enemies.push(agent);
            }
        }

        this.logger.debug(`updated agent information. New enemies: ${this.enemies.length}, ${this.enemies.map(a => {a.id, a.x, a.y})}`);
    }


    updateConfig (config) {
        // Update the belief about the game configuration based on the configuration information received. This can involve updating properties such as clock, capacity, decayEvent, and generationEvent based on the config data.
        this.config = new GameConfig(config);
        this.logger.debug(`updated config information. New config: ${this.config}`);
    }
}

export { Belief };