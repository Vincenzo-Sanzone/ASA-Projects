import { Belief } from "../belief/belief.js";
import { Movement, Parcel, Logger } from "../../utility/index.js";

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

        // Delete desires with non-positive priority, as they are not worth pursuing.
        this.desires = this.desires.filter(desire => desire.priority > 0);

        // Sort desires by priority in descending order, so that the most important desires are pursued first.
        this.desires.sort((a, b) => b.priority - a.priority);

        this.logger.debug(`Desires: ${this.desires.map(d => `${d.type}(${d.priority})`).join(", ")}`);
    }

    /**
     * Calculates priority for picking up a parcel.
     * Considers: reward, distance, nearby parcels, proximity to delivery points, and decay.
     * @param {Parcel} parcel - The parcel to evaluate.
     * @param {Belief} belief - Current world state.
     * @returns {number} Priority score (higher = better, no cap).
     */
    calculatePickUpPriority(parcel, belief) {
        const carrying = belief.parcels.filter(p => p.carriedBy === belief.me?.id).length;
        const canCarry = belief.config?.capacity ? belief.config.capacity - carrying : Infinity;
        if (canCarry <= 0) return -1;

        const me = { x: belief.me.x, y: belief.me.y };
        const distToParcel = Movement.getDistance(belief.config.map, me, { x: parcel.x, y: parcel.y });
        if (distToParcel === Infinity || distToParcel === 0) return -1;

        // === PRIORITÀ BASE: 100 / distanza (pacchi vicini = priorità molto alta) ===
        let priority = 100 / (distToParcel + 1); // Es: distanza=1 → 50, distanza=2 → 33.3

        // === BONUS: Reward alto ===
        priority += parcel.reward * 0.5; // +5 per reward=10

        // === BONUS: Pacchi vicini (raccogli più insieme) ===
        const nearbyParcels = belief.parcels.filter(p =>
            p.carriedBy === null &&
            Movement.getDistance(belief.config.map, { x: p.x, y: p.y }, { x: parcel.x, y: parcel.y }) <= 2
        ).length;
        priority += nearbyParcels * 10; // +10 per ogni pacco vicino

        // === BONUS: Vicino a delivery point (consegna veloce) ===
        const deliveryPoints = Movement.getDeliveryPoints(belief.config.map);
        if (deliveryPoints.length > 0) {
            const distToDelivery = Math.min(
                ...deliveryPoints.map(dp =>
                    Movement.getDistance(belief.config.map, { x: parcel.x, y: parcel.y }, dp)
                )
            );
            if (distToDelivery < 5) {
                priority += 20; // Bonus se vicino a delivery
            }
        }

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

        // === PRIORITÀ MASSIMA: Già su delivery point o capacità piena ===
        if (belief.config.map.tiles[belief.me.y]?.[belief.me.x]?.toString() === '2') return 1000;
        const carrying = parcels.length;
        const canCarry = belief.config?.capacity ? belief.config.capacity - carrying : Infinity;
        if (canCarry <= 0) return 1000;

        // === Distanza al delivery point più vicino ===
        const distToDelivery = Movement.nearestDeliveryPoint(belief.config.map, { x: belief.me.x, y: belief.me.y }).distance;
        if (distToDelivery === Infinity) return -1;

        // === Reward totale stimato al momento della consegna ===
        const decayTimeMs = this.clockEventToMs(belief.config?.decayEvent);
        const clockMs = belief.config.clock || 50;
        const totalReward = parcels.reduce(
            (sum, p) => sum + this.estimateRewardAfterSteps(p.reward, distToDelivery, clockMs, decayTimeMs),
            0
        );
        if (totalReward <= 0) return -1;

        // === Priorità: 500 / distanza + bonus per più pacchi ===
        const multiBonus = parcels.length > 1 ? parcels.length * 50 : 0;
        return (500 / (distToDelivery + 1)) + multiBonus + totalReward * 0.1;
    }


    /**
     * 
     * @param {Belief} belief 
     */
    calculateLookForParcelPriority(belief) {
        const carrying = belief.parcels.filter(p => p.carriedBy === belief.me?.id).length;
        const canCarry = belief.config?.capacity ? belief.config.capacity - carrying : Infinity;
        if (canCarry <= 0 || !belief.config) return -1;

        // === Se ci sono pacchi visibili, NON cercare ===
        const visibleFree = belief.parcels.filter(p => p.carriedBy === null).length;
        if (visibleFree > 0) return -1;

        const { decayEvent, generationEvent, variance, average, maxParcels } = belief.config;

        const decayTimeSec = this.clockEventToMs(decayEvent) / 1000;
        const genTimeSec = this.clockEventToMs(generationEvent) / 1000;

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
                        Movement.getDistance(belief.config.map, { x: belief.me.x, y: belief.me.y }, sp)
                    )
                );
                priority += 50 / (distToSpawn + 1); // Bonus se spawn point vicino
            }
        }

        // === Priorità finale (10-50) ===
        return priority + variance / 100;
    }

    /**
     * Converte un IOClockEvent in millisecondi.
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOClockEvent | undefined} event - Es: '1s', 'frame', 'infinite'
     * @returns {number} Tempo in millisecondi (o Infinity)
     */
    clockEventToMs(event) {
        switch (event) {
            case 'frame': return 50;     // 1 frame ≈ 50ms (1/20 di secondo, basato su CLOCK: 50)
            case '1s': return 1000;
            case '2s': return 2000;
            case '5s': return 5000;
            case '10s': return 10000;
            case 'infinite': return Infinity;
            default: return Infinity; // Valore sconosciuto
        }
    }

    // ─── Helper condivisi ────────────────────────────────────────────────

    /**
     * Stima il reward di un pacco dopo `steps` passi, considerando il decay.
     * Ogni passo impiega `clockMs` ms; il reward cala di 1 ogni `decayTimeMs`.
     */
    estimateRewardAfterSteps(reward, steps, clockMs, decayTimeMs) {
        if (decayTimeMs === Infinity || decayTimeMs === 0) return reward;
        const elapsed = steps * clockMs;
        return Math.max(0, reward - elapsed / decayTimeMs);
    }

}

export { Desires };