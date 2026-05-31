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
        this.desires.push({ type: 'deliver', priority: 0 });

        // Generate look for parcel desires. Low priority, so it is done only if there are no pickup or delivery desires, and it is useful to update the belief about parcels that may have changed since the last sensing.
        this.desires.push({ type: 'lookForParcel', priority: -1 });

        // Delete desires with non-positive priority, as they are not worth pursuing.
        this.desires = this.desires.filter(desire => desire.priority > 0);

        // Sort desires by priority in descending order, so that the most important desires are pursued first.
        this.desires.sort((a, b) => b.priority - a.priority);

        this.logger.debug(`Generated desires: ${this.desires.map(d => d.type).join(", ")}`);
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
        const canCarry = belief.config?.capacity
            ? belief.config.capacity - carrying
            : Infinity;

        if (canCarry <= 0) return -1;

        const me = { x: belief.me.x, y: belief.me.y };

        // Distanza da me al pacco
        const distToParcel = Movement.getDistance(belief.config.map, me, { x: parcel.x, y: parcel.y });
        if (distToParcel === Infinity) return -1;

        // Distanza dal pacco al punto di consegna più vicino
        const deliveryPoints = this.getDeliveryPoints(belief.config.map);
        if (deliveryPoints.length === 0) return -1;
        const distToDelivery = Math.min(
            ...deliveryPoints.map(dp =>
                Movement.getDistance(belief.config.map, { x: parcel.x, y: parcel.y }, dp)
            )
        );
        if (distToDelivery === Infinity) return -1;

        // Stima del reward quando CONSEGNO (viaggio completo)
        const totalSteps = distToParcel + distToDelivery;
        const decayTimeMs = this.clockEventToMs(belief.config?.decayEvent);
        const rewardOnDeliver = this.estimateRewardAfterSteps(
            parcel.reward, totalSteps, belief.config.clock, decayTimeMs
        );

        // Se il pacco decadrà completamente prima che riesca a consegnarlo, inutile raccoglierlo
        if (rewardOnDeliver <= 0) return -1;

        // Valore per passo (unità comune con delivery e lookForParcel)
        return rewardOnDeliver / (totalSteps + 1);
    }

    /**
     * 
     * @param {Parcel[]} parcels 
     * @param {Belief} belief 
     * @returns 
     */
    calculateDeliveryPriority(parcels, belief) {
        if (parcels.length === 0) return -1;

        const deliveryPoints = this.getDeliveryPoints(belief.config.map);
        if (deliveryPoints.length === 0) return -1;

        // Già su un punto di consegna → priorità massima
        if (belief.config.map.tiles[belief.me.y]?.[belief.me.x]?.toString() === '2') return 999;

        // Capacità piena → devo consegnare per forza
        const carrying = parcels.length;
        const canCarry = belief.config?.capacity ? belief.config.capacity - carrying : Infinity;
        if (canCarry <= 0) return 999;

        // Punto di consegna più vicino a me
        const distToDelivery = Math.min(
            ...deliveryPoints.map(dp =>
                Movement.getDistance(belief.config.map, { x: belief.me.x, y: belief.me.y }, dp)
            )
        );
        if (distToDelivery === Infinity) return -1;

        // Reward totale stimato al momento della consegna (ogni pacco può decadere)
        const decayTimeMs = this.clockEventToMs(belief.config?.decayEvent);
        const totalReward = parcels.reduce(
            (sum, p) => sum + this.estimateRewardAfterSteps(p.reward, distToDelivery, belief.config.clock, decayTimeMs),
            0
        );
        if (totalReward <= 0) return -1;

        // Valore per passo + piccolo bonus efficienza per più pacchi (stesso viaggio)
        const multiBonus = parcels.length > 1 ? parcels.length * 0.3 : 0;
        return (totalReward / (distToDelivery + 1)) + multiBonus;
    }


    /**
     * 
     * @param {Belief} belief 
     */
    calculateLookForParcelPriority(belief) {
        const carrying = belief.parcels.filter(p => p.carriedBy === belief.me?.id).length;
        const canCarry = belief.config?.capacity ? belief.config.capacity - carrying : Infinity;
        if (canCarry <= 0 || !belief.config) return -1;

        const { decayEvent, generationEvent, variance, average, maxParcels } = belief.config;

        // Solo i pacchi a terra (non trasportati) sono "visibili" ai fini dell'esplorazione
        const visibleFree = belief.parcels.filter(p => p.carriedBy === null).length;
        const hiddenParcels = Math.max(0, maxParcels - visibleFree);
        if (hiddenParcels === 0) return -1;

        const decayTimeSec = this.clockEventToMs(decayEvent) / 1000;
        const genTimeSec = this.clockEventToMs(generationEvent) / 1000;

        // Probabilità che un pacco nascosto sia ancora vivo quando lo trovo
        const lifetime = average * decayTimeSec; // secondi di vita medi
        const usefulProb = Math.min(1, lifetime / genTimeSec);

        // Stima distanza media per trovare un pacco nascosto:
        // approssimiamo con sqrt(celle_camminabili / maxParcels)
        const walkableTiles = belief.config.map.tiles
            .flat().filter(t => t.toString() !== '0').length;
        const expectedExploreSteps = Math.sqrt(walkableTiles / (maxParcels + 1));

        // Valore atteso per passo (stessa unità di pickup e delivery)
        const expectedReward = hiddenParcels * average * usefulProb;
        const priority = expectedReward / (expectedExploreSteps + 1);

        // Piccolo boost per alta varianza (chance di trovare pacchi molto preziosi)
        return priority + variance / 200;
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

    /** Restituisce tutte le celle di consegna della mappa. */
    getDeliveryPoints(map) {
        return map.tiles
            .flatMap((row, y) => row.map((v, x) => v?.toString() === '2' ? { x, y } : null))
            .filter(Boolean);
    }
}

export { Desires };