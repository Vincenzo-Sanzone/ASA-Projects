import { Belief } from "../belief/belief.js";
import { Movement, Parcel, Logger, Strategy, Mission } from "../../utility/index.js";

//TODO fix the priority so it becames more balanced
class Desires {
    constructor() {
        this.desires = [];
        this.logger = new Logger("Desires:");
    }

    /**
     * 
     * @param {Belief} belief 
     */
    generateDesires(belief) {
        // Generate desires based on the current belief. This can involve creating a list of desires that the agent wants to achieve based on the information it has about itself, other agents, parcels, and the game configuration.
        this.desires = []; // Clear previous desires    

        this.logger.debug(`I know that there are ${belief.parcels.length} parcels`);
        for (const parcel of belief.parcels) {
            // Generate pickup desires for parcels that are not currently being carried by any agent.
            if (parcel.carriedBy === null) {
                this.desires.push({ type: 'pickup', parcelId: parcel.id, priority: this.calculatePickUpPriority(parcel, belief) });
            }
        }

        // Generate delivery desires for parcels that are currently being carried by the agent.
        const carriedParcels = belief.parcels.filter(parcel => parcel.carriedBy === belief.me.id);
        this.desires.push({ type: 'deliver', priority: this.calculateDeliveryPriority(carriedParcels, belief) });

        // Generate look for parcel desires. Low priority, so it is done only if there are no pickup or delivery desires, and it is useful to update the belief about parcels that may have changed since the last sensing.
        this.desires.push({ type: 'lookForParcel', priority: this.calculateLookForParcelPriority(belief) });

        if (belief.thereIsAtomicMission) {
            for (const mission of belief.missions) {
                if (!mission.persistent) {
                    this.desires.push({ type: 'mission', mission: mission, priority: this.calculateMissionPriority(mission, belief) });
                }
            }
        }
        // Delete desires with non-positive priority, as they are not worth pursuing.
        this.desires = this.desires.filter(desire => desire.priority > 0);

        // Sort desires by priority in descending order, so that the most important desires are pursued first.
        this.desires.sort((a, b) => b.priority - a.priority);
        this.desires.forEach(desire => this.logger.debug(`Desire: ${desire.type}, Priority: ${desire.priority}`));
    }

    /**
     * 
     * @param {Mission} mission 
     * @param {Belief} belief 
     */
    calculateMissionPriority(mission, belief) {
        // TODO fix priority, for the moment we want to test mission.
        return 100000;
    }

    /**
     * Calculates priority for picking up a parcel.
     * Considers: reward, distance, nearby parcels, proximity to delivery points, and decay.
     * @param {Parcel} parcel - The parcel to evaluate.
     * @param {Belief} belief - Current world state.
     * @returns {number} Priority score (higher = better, no cap).
     */
    calculatePickUpPriority(parcel, belief) {
        const me = { x: belief.me.x, y: belief.me.y };
        const distToParcel = Movement.getDistance(belief.config.map, me, { x: parcel.x, y: parcel.y }, belief.enemies);
        if (distToParcel === Infinity) return -1;
        if (distToParcel === 0) return 900 + parcel.reward;

        const estimatedReward = this.estimateRewardAfterSteps(parcel.reward, distToParcel, 50, Strategy.clockEventToMs(belief.config.decayEvent));
        if (estimatedReward <= 10) return -1;
        if (distToParcel <= belief.config?.observationDistance) {
            this.logger.debug(`Parcel ${parcel.id} distance to me: ${distToParcel}, is within observation distance (${belief.config?.observationDistance})`);
            return 900 + parcel.reward - distToParcel;
        }

        const priority = parcel.reward - distToParcel;

        return priority;
    }

    /**
     * 
     * @param {Parcel[]} parcels 
     * @param {Belief} belief 
     * @returns 
     */
    calculateDeliveryPriority(parcels, belief) {
        if (parcels.length === 0) return -1;

        const deliveryPoints = Movement.getDeliveryPoints(belief.config.map);
        if (deliveryPoints.length === 0) return -1;

        // Max priority if we can't carry more parcels or if we are on a delivery tile
        if (belief.config.map.tiles[belief.me.x]?.[belief.me.y]?.toString() === '2') return 1000;
        const carrying = parcels.length;
        const canCarry = belief.config?.capacity ? belief.config.capacity - carrying : Infinity;
        this.logger.debug(`We are carrying ${carrying} parcels and so we can carry ${canCarry} more`);
        if (canCarry <= 0) return 1000;

        // Distance from the nearest delivery point
        const { distance } = Movement.nearestDeliveryPoint(belief.config.map, { x: belief.me.x, y: belief.me.y });
        if (distance === Infinity) return -1;

        // Priority is based on the distance to the nearest delivery point, and the number of parcels we can carry
        const priority = 100 + carrying * 10;
        return priority
    }


    /**
     * 
     * @param {Belief} belief 
     */
    calculateLookForParcelPriority(belief) {
        // === Se ci sono pacchi visibili, NON cercare ===
        const visibleFree = belief.parcels.filter(p => p.carriedBy === null).length;
        if (visibleFree > 0) return 1;

        const { decayEvent, generationEvent, variance, average, maxParcels } = belief.config;

        const decayTimeSec = Strategy.clockEventToMs(decayEvent) / 1000;
        const genTimeSec = Strategy.clockEventToMs(generationEvent) / 1000;

        // === Probabilità che un pacco nascosto sia ancora vivo ===
        const lifetime = average * decayTimeSec;
        const usefulProb = Math.min(1, lifetime / genTimeSec);

        // === Stima distanza media per trovare un pacco ===
        const walkableTiles = belief.config.map.tiles
            .flat().filter(t => t.toString() !== '0').length;
        const expectedExploreSteps = Math.sqrt(walkableTiles / (maxParcels + 1));

        // === Priorità base (10-20) ===
        const expectedReward = maxParcels * average * usefulProb;
        let priority = expectedReward / (expectedExploreSteps + 1);

        // === BONUS: Punti di spawn vuoti (vai a controllare se ci sono pacchi) ===
        const spawnPoints = belief.config.map.tiles
            .flatMap((row, y) => row.map((v, x) => v?.toString() === '5' ? { x, y } : null)) // '5' = spawn point
            .filter(Boolean);

        if (spawnPoints.length > 0) {
            const emptySpawnPoints = spawnPoints.filter(sp =>
                !belief.parcels.some(p => p.x === sp.x && p.y === sp.y && p.carriedBy === null)
            );
            if (emptySpawnPoints.length > 0) {
                const distToSpawn = Math.min(
                    ...emptySpawnPoints.map(sp =>
                        Movement.getDistance(belief.config.map, { x: belief.me.x, y: belief.me.y }, sp, belief.enemies)
                    )
                );
                priority += 50 / (distToSpawn + 1); // Bonus se spawn point vicino
            }
        }

        // === Priorità finale (10-50) ===
        return priority + variance / 100;
    }

    // ─── Helper condivisi ────────────────────────────────────────────────

    /**
     * Stima il reward di un pacco dopo `steps` passi, considerando il decay.
     * Ogni passo impiega `clockMs` ms; il reward cala di 1 ogni `decayTimeMs`.
     */
    estimateRewardAfterSteps(reward, steps, clockMs, decayTimeMs) {
        if (decayTimeMs === Infinity || decayTimeMs === 0) return reward;
        const elapsed = steps * clockMs * 2;
        return Math.max(0, reward - elapsed / decayTimeMs);
    }

}

export { Desires };