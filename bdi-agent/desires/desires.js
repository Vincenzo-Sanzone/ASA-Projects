import { Belief } from "../belief/belief.js";
import { Movement, Parcel } from "../../utility/index.js";

//TODO fix the priority so it becames more balanced
class Desires {
    constructor() {
        this.desires = [];
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

        console.log("Generated desires:", this.desires);
    }

    /**
     * Calculates priority for picking up a parcel.
     * Considers: reward, distance, nearby parcels, proximity to delivery points, and decay.
     * @param {Parcel} parcel - The parcel to evaluate.
     * @param {Belief} belief - Current world state.
     * @returns {number} Priority score (higher = better, no cap).
     */
    calculatePickUpPriority(parcel, belief) {
        const carryingParcels = belief.parcels.filter(p => p.carriedBy === belief.me?.id).length;
        const howManyCanICarry = belief.config?.capacity ? belief.config.capacity - carryingParcels : Infinity;

        // Cannot pick up if at full capacity
        if (howManyCanICarry <= 0) {
            return -1;
        }

        const distance = Movement.getDistance(
            belief.config.map,
            { x: belief.me.x, y: belief.me.y },
            { x: parcel.x, y: parcel.y }
        );

        if (distance === 0) {
            return Infinity; // Already on the parcel
        }

        // === BASE PRIORITY: reward / distance (scaled by 10) ===
        let priority = (parcel.reward / (distance + 1)) * 10;

        // === BONUS: Nearby parcels (pick up multiple in one trip) ===
        const nearbyParcels = belief.parcels.filter(p =>
            p.carriedBy === null &&
            Movement.getDistance(belief.config.map, { x: p.x, y: p.y }, { x: parcel.x, y: parcel.y }) <= 2
        ).length - 1; // Exclude self
        priority += nearbyParcels * 0.5; // +0.5 per nearby parcel

        // === BONUS: Close to delivery point (faster delivery = higher priority) ===
        const deliveryPoints = belief.config?.map.tiles.flatMap((row, y) =>
            row.map((value, x) => (value.toString() === '2' ? { x, y } : null))
        ).filter(dp => dp !== null) || [];

        if (deliveryPoints.length > 0) {
            const nearestDelivery = deliveryPoints.reduce((nearest, dp) => {
                const dist = Movement.getDistance(belief.config.map, { x: parcel.x, y: parcel.y }, dp);
                const nearestDist = Movement.getDistance(belief.config.map, { x: parcel.x, y: parcel.y }, nearest);
                return dist < nearestDist ? dp : nearest;
            }, deliveryPoints[0]);

            const distanceToDelivery = Movement.getDistance(
                belief.config.map,
                { x: parcel.x, y: parcel.y },
                nearestDelivery
            );
            // Closer to delivery = higher priority
            priority += (1 / (distanceToDelivery + 1)) * 2; // Max +2 if adjacent to delivery
        }

        // === BONUS: Fast decay (parcels about to expire) ===
        const decayTimeMs = this.clockEventToMs(belief.config?.decayEvent);
        if (decayTimeMs !== Infinity && decayTimeMs > 0) {
            priority += (parcel.reward * 0.1) / decayTimeMs; // +0.1 per reward per second of decay
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
        const howManyCanICarry = belief.config?.capacity ? belief.config.capacity - parcels.length : Infinity;
        if (parcels.length === 0) {
            return -1;
        }

        // Maximum priority if already on a delivery point
        if (belief.config?.map.tiles[belief.me.y][belief.me.x]?.toString() === '2') {
            return Infinity;
        }

        // Maximum priority if at full capacity (must deliver to pick up more)
        if (howManyCanICarry <= 0) {
            return Infinity;
        }

        // Find the nearest delivery point to the player
        const deliveryPoints = belief.config?.map.tiles.flatMap((row, y) =>
            row.map((value, x) => (value.toString() === '2' ? { x, y } : null))
        ).filter(dp => dp !== null) || [];

        if (deliveryPoints.length === 0) {
            return -1;
        }

        let nearest = { x: -1, y: -1, distance: Infinity };
        for (const dp of deliveryPoints) {
            const distance = Movement.getDistance(
                belief.config.map,
                { x: belief.me.x, y: belief.me.y },
                dp
            );
            if (distance < nearest.distance) {
                nearest = { x: dp.x, y: dp.y, distance };
            }
        }

        if (nearest.distance === Infinity) {
            return -1;
        }

        // === BASE PRIORITY: (total reward * number of parcels) / distance ===
        const totalReward = parcels.reduce((total, parcel) => total + parcel.reward, 0);
        let priority = totalReward * belief.config?.clock.valueOf() - (nearest.distance * 2); // Penalize distance, but reward more for higher total reward

        // === BONUS: Carrying multiple parcels (deliver sooner for higher efficiency) ===
        if (parcels.length > 1) {
            priority += 5; // Flat bonus for carrying multiple
        }

        return priority;
    }


    /**
     * 
     * @param {Belief} belief 
     */
    calculateLookForParcelPriority(belief) {
        const carriedParcels = belief.parcels.filter(parcel => parcel.carriedBy === belief.me?.id);
        const howManyCanICarry = belief.config?.capacity ? belief.config.capacity - carriedParcels.length : Infinity;
        // If we are carryng all the parcels we can, then we should not look for new parcels.
        if (howManyCanICarry <= 0) {
            return -1;
        }

        if (!belief.config) {
            return -1; // No config, cannot calculate priority
        }
        const { decayEvent, generationEvent, variance, average, maxParcels } = belief.config;
        const visibleParcels = belief.parcels.length;;

        // Convert in seconds.
        const decayTimeSec = this.clockEventToMs(decayEvent) / 1000;
        const generationTimeSec = this.clockEventToMs(generationEvent) / 1000;

        // Average lifetime of a parcel in seconds, based on the decay time. This is an estimate of how long parcels last before they decay and disappear from the game.
        const lifetimeSec = average * decayTimeSec;

        // Expected number of parcels that are currently hidden.
        const expectedHiddenParcels = Math.max(0, maxParcels - visibleParcels);

        // Probability that an hidden parcel is still available by the time we find it, based on its expected lifetime and the generation time.
        const usefulnessProbability = Math.min(1, lifetimeSec / generationTimeSec);

        // Base priority is the expected number of parcels we can find multiplied by the average reward and the probability that looking for parcels will be useful.
        let priority = expectedHiddenParcels * average * usefulnessProbability;

        // Bonus if there aren't many visible parcels.
        if (visibleParcels === 0) {
            priority *= 1.5;
        }

        // Penality if the parcels generation time is long, as it means that new parcels appear rarely and looking for them is less useful.
        if (generationTimeSec > 5) { // Se generazione > 5s
            priority *= 0.8;
        }

        // Bonus high variance
        priority += variance / 50;

        return priority
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
}

export { Desires };