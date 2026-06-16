import { Logger, Agent, Parcel, GameConfig, Movement, Strategy, Crates, Mission, TYPE_MISSION, Coordinator } from "../../utility/index.js";

class Belief {
    /**
     * 
     * @param {Coordinator} coordinator 
     * @param {string} teammateId
     */
    constructor(coordinator, teammateId, agentName) {
        this.me = null;
        this.teammate = teammateId;
        this.enemies = []; // List of other agents with their id, x, y, timestampSeen
        this.config = null;
        this.parcels = []; // List of parcels with their id, position, reward, carriedBy, timestampSeen
        this.crates = []; // List of crates with id and position
        this.missions = []; // List of missions 
        this.thereIsAtomicMission = false;
        this.isNeededReconsidering = false; // Flag to indicate if the belief needs to be reconsidered due to changes in the environment or new information received.
        this.waiting = false; //Flag to indicate if we are waiting for a mission to complete
        this.isMyTeammateWaiting = false; // Flag to indicate if the teammate is waiting for the near the target mission
        this.coordinator = coordinator
        this.meetAt = null
        this.playRedGreen = false // Flag to indicate if we are playing red/green light
        this.collaborationRequired = false

        this.logger = new Logger("Belief:", agentName);
    }

    #initializeCrates() {
        for (let x = 0; x < this.config.map.width; x++) {
            for (let y = 0; y < this.config.map.height; y++) {
                if (this.config.map.tiles[x][y].toString() === '5!') {
                    this.crates.push(new Crates({ x, y }));
                }
            }
        }
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

        this.coordinator.sendMe({x: this.me.x, y: this.me.y});
        this.updateRewardParcel();
    }

    updateTeammate(x, y) {
        const teammate = this.getTeammate();
        if (!teammate) return;
        teammate.x = x;
        teammate.y = y;
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
                parcel.pickedByTeammate = this.parcels[existingParcelIndex].pickedByTeammate || (sensedParcel.carriedBy !== null && sensedParcel.carriedBy !== this.me.id)
                parcel.pickedByMe = this.parcels[existingParcelIndex].pickedByMe || sensedParcel.carriedBy === this.me.id
                // Update existing parcel information
                this.parcels[existingParcelIndex] = parcel;
            } else {
                // Add new parcel
                parcel.pickedByTeammate = sensedParcel.carriedBy !== null && sensedParcel.carriedBy !== this.me.id
                this.parcels.push(parcel);
                this.isNeededReconsidering = true; // If a new parcel is found, we may need to reconsider our intentions, as there may be new opportunities for pickup that were not previously known.
            }
        }
        // Remove non sensed parcels that i knew were there.
        const visibleIds = new Set(parcels.map(p => p.id));
        this.parcels = this.filterNotInViewObject(this.parcels, visibleIds);
        this.updateRewardParcel();
    }

    /**
     * Update the belief about crates based on the sensing data.
     * @param {*} crates - Crates sent by the server 
     */
    updateCrates(crates) {
        if (crates.length === 0) return;
        for (const c of crates) {
            const crate = new Crates(c);
            let existingCrateIndex = this.crates.findIndex(p => p.id === crate.id);
            if (existingCrateIndex !== -1) {
                this.crates[existingCrateIndex] = crate;
                continue;
            }
            existingCrateIndex = this.crates.findIndex(p => p.x === crate.x && p.y === crate.y);
            if (existingCrateIndex !== -1) {
                this.crates[existingCrateIndex] = crate;
                continue;
            }
            this.crates.push(crate);
        }
    }

    /**
     * This function filters out objects that should be visible to the agent, but are not in the view of the agent.
     * @param {Array} array - Array of objects to filter.
     */
    filterNotInViewObject(array, visibleIds) {
        return array.filter(obj => {
            const dx = Math.abs(obj.x - this.me.x);
            const dy = Math.abs(obj.y - this.me.y);
            const isInView = dx + dy <= this.config?.observationDistance;

            // If the parcel object is visible, remove it
            return !(isInView && !visibleIds.has(obj.id));
        })
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
    removeDeliveredParcel() {
        this.parcels = this.parcels.filter(parcel => parcel.carriedBy !== this.me.id);
    }

    removePassingParcels() {
        const carriedParcel = this.parcels.find(parcel => parcel.carriedBy === this.me.id);
        for (const parcel of this.parcels) {
            parcel.carriedBy = null;
        }
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
            if (sensedAgent.id === this.teammate && (sensedAgent.x % 1 !== 0 || sensedAgent.y % 1 !== 0)) {
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

        // Remove non sensed agents that i knew were there.
        const visibleIds = new Set(agents.map(p => p.id));
        this.enemies = this.filterNotInViewObject(this.enemies, visibleIds);
    }


    updateConfig(config) {
        // Update the belief about the game configuration based on the configuration information received. This can involve updating properties such as clock, capacity, decayEvent, and generationEvent based on the config data.
        this.config = new GameConfig(config);
        this.#initializeCrates();
        this.logger.debug(`updated config information. New config: ${this.config}`);
    }

    removeNeedToReconsider() {
        this.isNeededReconsidering = false;
    }

    /**
     * 
     * @param {Mission} mission 
     */
    addMission(mission) {
        if (!mission.persistent) this.thereIsAtomicMission = true; 
        if (mission.isNegative() && (mission.type === TYPE_MISSION.MOVE || mission.type === TYPE_MISSION.MOVEMENT_TILE)) {
            this.config.map.tiles[mission.args.x][mission.args.y] = '0';
        }
        this.missions.push(mission);
    }

    /**
     * 
     * @param {Mission} mission 
     */
    removeMission(mission) {
        this.missions = this.missions.filter(m => m !== mission);

        this.thereIsAtomicMission = this.missions.some(m => !m.persistent);
    }

    #getMissions(type) {
        return this.missions.filter(m => m.type === type);    
    }

    getDeliveryStackMissions() {
        return this.#getMissions(TYPE_MISSION.DELIVERY_STACK);
    }

    getDeliveryLocationMissions() {
        return this.#getMissions(TYPE_MISSION.DELIVERY_LOCATION);
    }

    getDeliveryScoreOverrideMissions() {
        return this.#getMissions(TYPE_MISSION.DELIVERY_SCORE);
    }

    getMovementTilePointsMissions() {
        return this.#getMissions(TYPE_MISSION.MOVEMENT_TILE);
    }

    thereIsCrossAgent() {
        return this.collaborationRequired || this.missions.some(m => m.type === TYPE_MISSION.CROSS_AGENT);
    }

    getTeammate() {
        for (const enemy of this.enemies) {
            if (enemy.id === this.teammate) return enemy;
        }
    }
}

export { Belief };