import { Belief } from "../belief/belief.js";
import { Movement, Parcel, Logger, Strategy, Mission, TYPE_MISSION } from "../../utility/index.js";

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
        //console.log("[DEBUG] Desires:", JSON.stringify(this.desires, null, 2));
    }

    /**
     * 
     * @param {Mission} mission 
     * @param {Belief} belief 
     */
    calculateMissionPriority(mission, belief) {
        if (mission.type === TYPE_MISSION.DROP && belief.parcels.filter(p => p.carriedBy === belief.me.id).length === 0) return 0;
        
        mission.reward * 100;
    }

    /**
     * Calculates priority for picking up a parcel.
     * Considers: reward, distance, nearby parcels, proximity to delivery points, and decay.
     * @param {Parcel} parcel - The parcel to evaluate.
     * @param {Belief} belief - Current world state.
     * @returns {number} Priority score (higher = better, no cap).
     */
    calculatePickUpPriority(parcel, belief) {
        const minimumReward = belief.config?.average - belief.config?.variance;
        const minimumGoodRewardPickup = Math.floor(minimumReward * 0.3);

        const canICarryMore = belief.config.capacity - belief.parcels.filter(p => p.carriedBy === belief.me.id).length;
        if (canICarryMore === 0) return 0;
        const distance = Movement.getDistance(belief.config?.map, belief.me, { x: parcel.x, y: parcel.y }, belief.enemies);

        if (parcel.reward < minimumGoodRewardPickup) return 0;

        let priority = 1 + parcel.reward - (distance / 5);
        const carriedParcels = belief.parcels.filter(p => p.carriedBy === belief.me.id);
    
        // Pick the mission with best multiplier
        const bestMission = belief.getDeliveryStackMissions().sort((a, b) => b.args.multiplier - a.args.multiplier)[0];

        const isGoodMultiplier = bestMission && bestMission.args.multiplier > 1;
        if (isGoodMultiplier && bestMission.args.size < carriedParcels.length) priority *= bestMission.args.multiplier;
        else if (bestMission && !isGoodMultiplier && bestMission.args.size === carriedParcels.length) priority *= 1 + bestMission.args.multiplier;
        if (isGoodMultiplier && bestMission.args.size === carriedParcels.length) return 0;
        else if ((bestMission === null || isGoodMultiplier) && distance == 0) return 1000;

        return priority;
    }

    /**
     * 
     * @param {Parcel[]} parcels 
     * @param {Belief} belief 
     * @returns 
     */
    calculateDeliveryPriority(parcels, belief) {
        const canICarryMore = belief.config.capacity - parcels.length;
        
        let summedReward = 0;
        const scoreMissions = belief.getDeliveryScoreOverrideMissions();
        for (const parcel of parcels) {
            for (const mission of scoreMissions) {
                switch (mission.args.operator) {
                    case '<': {
                        if (mission.args.score < parcel.reward) summedReward += (parcel.reward * mission.args.multiplier);
                        break;
                    }
                    case '>': {
                        if (mission.args.score > parcel.reward) summedReward += (parcel.reward * mission.args.multiplier);
                        break;
                    }
                    case '==': {
                        if (mission.args.score === parcel.reward) summedReward += (parcel.reward * mission.args.multiplier);
                        break;
                    }
                }
            }
            if (scoreMissions.length === 0) summedReward += parcel.reward;
        }

        if (canICarryMore === 0) return summedReward;
        const nearestDeliveryPoint = Movement.nearestDeliveryPoint(belief.config?.map, belief.me); 
        if (belief.missions.length === 0 && nearestDeliveryPoint.distance === 0) return 100;
        
        const minimumReward = belief.config?.average - belief.config?.variance;
        const minimumGoodRewardPickup = Math.floor(minimumReward * 0.5);

        let priority = summedReward;
        // Pick the mission with best multiplier
        const bestMission = belief.getDeliveryStackMissions().sort((a, b) => b.args.multiplier - a.args.multiplier)[0];
        if (bestMission && bestMission.args.size === parcels.length) priority *= bestMission.args.multiplier;
        return priority - (canICarryMore * minimumGoodRewardPickup);
    }

    /**
     * 
     * @param {Belief} belief 
     */
    calculateLookForParcelPriority(belief) {
        const minimumReward = belief.config?.average - belief.config?.variance;
        const minimumGoodRewardPickup = Math.floor(minimumReward * 0.8);

        // If there are visible free parcels, pick them
        const visibleFree = belief.parcels.filter(p => p.carriedBy === null && p.reward >= minimumGoodRewardPickup).length;
        if (visibleFree > 0) return 1;
        const canICarryMore = belief.config.capacity - belief.parcels.filter(p => p.carriedBy === belief.me.id).length;
        if (canICarryMore === 0) return 1;

        let priority = 1;
        const carriedParcels = belief.parcels.filter(p => p.carriedBy === belief.me.id);
        // Pick the mission with best multiplier
        const bestMission = belief.getDeliveryStackMissions().sort((a, b) => b.args.multiplier - a.args.multiplier)[0];
        if (bestMission && bestMission.args.size < carriedParcels.length) priority *= bestMission.args.multiplier;
        else if (bestMission && bestMission.args.size === carriedParcels.length && bestMission.args.multiplier < 1) priority *= 1 + bestMission.args.multiplier;

        return priority + minimumGoodRewardPickup;
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