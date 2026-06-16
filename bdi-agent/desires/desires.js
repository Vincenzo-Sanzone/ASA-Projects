import { Belief } from "../belief/belief.js";
import { Movement, Parcel, Logger, Strategy, Mission, TYPE_MISSION } from "../../utility/index.js";

//TODO fix the priority so it becames more balanced
class Desires {
    constructor(agentName) {
        this.desires = [];
        this.logger = new Logger("Desires:", agentName);
    }

    /**
     * 
     * @param {Belief} belief 
     */
    generateDesires(belief) {
        if (belief.waiting) {
            return
        }
        // Generate desires based on the current belief. This can involve creating a list of desires that the agent wants to achieve based on the information it has about itself, other agents, parcels, and the game configuration.
        this.desires = []; // Clear previous desires    

        if (belief.meetAt) this.desires.push({ type: 'meet', priority: 100 });

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

        if (belief.thereIsAtomicMission || belief.playRedGreen) {
            for (const mission of belief.missions) {
                if (!mission.persistent || (belief.playRedGreen && mission.type === TYPE_MISSION.RED_GREEN_LIGHT)) {
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
        if (mission.type === TYPE_MISSION.DROP && belief.parcels.filter(p => p.carriedBy === belief.me.id).length === 0) return 0;

        return mission.reward * 100;
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

        // I don't want to pick up a parcel that i have already picked up (so we can do cross-agent delivery)
        if (parcel.pickedByMe) return 0;

        // Priority to pick up a parcel that has been picked up by a teammate (so we can do cross-agent delivery)
        if (parcel.pickedByTeammate) return parcel.reward + 100;

        let priority = 1 + this.#getMarginalPickupReward(parcel, belief) - (distance / 5);
        const carriedParcels = belief.parcels.filter(p => p.carriedBy === belief.me.id);

        // Pick the mission with best multiplier
        const bestMission = belief.getDeliveryStackMissions().sort((a, b) => b.reward - a.reward)[0];
        if (bestMission && !bestMission.isNegative() && bestMission.args.size < carriedParcels.length) priority = this.#applyRewardModifiers(priority, bestMission);
        else if (bestMission && bestMission.isNegative() && bestMission.args.size === carriedParcels.length) priority = this.#applyRewardModifiers(priority, bestMission);
        if (bestMission && !bestMission.isNegative() && bestMission.args.size === carriedParcels.length) return 0;
        else if ((bestMission === undefined || !bestMission.isNegative()) && distance == 0) return 1000;

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

        const scoreMissions = belief.getDeliveryScoreOverrideMissions();
        const summedReward = this.#getSummedReward(parcels, scoreMissions);

        if (canICarryMore === 0) return summedReward;
        const nearestDeliveryPoint = Movement.nearestDeliveryPoint(belief.config?.map, belief.me);
        if (belief.missions.length === 0 && nearestDeliveryPoint?.distance === 0) return 100;

        const minimumReward = belief.config?.average - belief.config?.variance;
        const minimumGoodRewardPickup = Math.floor(minimumReward * 0.5);

        let priority = summedReward;
        // Pick the mission with best multiplier
        const bestMission = belief.getDeliveryStackMissions().sort((a, b) => b.reward - a.reward)[0];
        if (bestMission && bestMission.args.size === parcels.length) priority = this.#applyRewardModifiers(priority, bestMission);
        
        if (belief.missions.length === 0 && nearestDeliveryPoint?.distance === 0) priority -= (canICarryMore * minimumGoodRewardPickup);
        
        return priority;
    }

    #getSummedReward(parcels, scoreMissions) {
        let summedReward = 0;
        const isSingleMission = scoreMissions.some(m => m.args.single);

        if (isSingleMission) {
            for (const parcel of parcels) {
                for (const mission of scoreMissions) {
                    if (!mission.args.single) break;
                    switch (mission.args.operator) {
                        case '<': {
                            if (parcel.reward < mission.args.score) summedReward += this.#applyRewardModifiers(parcel.reward, mission, false);
                            else summedReward += parcel.reward;
                            break;
                        }
                        case '>': {
                            if (parcel.reward > mission.args.score) summedReward += this.#applyRewardModifiers(parcel.reward, mission, false);
                            else summedReward += parcel.reward;
                            break;
                        }
                    }
                }
            }
        }
        else {
            summedReward = parcels.reduce((sum, parcel) => sum + parcel.reward, 0);
            for (const mission of scoreMissions) {
                if (mission.args.single) break;
                switch (mission.args.operator) {
                    case '<': {
                        if (summedReward < mission.args.score) summedReward += this.#applyRewardModifiers(summedReward, mission, false);
                        break;
                    }
                    case '>': {
                        if (summedReward > mission.args.score) summedReward += this.#applyRewardModifiers(summedReward, mission, false);
                        break;
                    }
                }
            }
        }
        return summedReward;
    }

    /**
     * 
     * @param {Belief} belief 
     */
    calculateLookForParcelPriority(belief) {
        const minimumReward = belief.config?.average - belief.config?.variance;
        const minimumGoodRewardPickup = Math.floor(minimumReward * 0.8);

        // If there are visible free parcels, pick them
        const visibleFree = belief.parcels.filter(p => p.carriedBy === null && p.reward >= minimumGoodRewardPickup && !p.pickedByMe).length;
        if (visibleFree > 0) return 1;
        const canICarryMore = belief.config.capacity - belief.parcels.filter(p => p.carriedBy === belief.me.id).length;
        if (canICarryMore === 0) return 1;

        let priority = 1;
        const carriedParcels = belief.parcels.filter(p => p.carriedBy === belief.me.id);
        // Pick the mission with best multiplier
        const bestMission = belief.getDeliveryStackMissions().sort((a, b) => b.reward - a.reward)[0];
        if (bestMission && bestMission.args.size < carriedParcels.length) priority = this.#applyRewardModifiers(priority, bestMission);
        else if (bestMission && bestMission.args.size === carriedParcels.length && bestMission.isNegative()) priority = this.#applyRewardModifiers(priority, bestMission);

        return priority + minimumGoodRewardPickup;
    }


    /**
     * 
     * @param {number} baseReward 
     * @param {Mission} mission 
     * @returns 
     */
    #applyRewardModifiers(baseReward, mission, wantAsPositive = true) {
        let reward = baseReward;

        let type, value;
        if (wantAsPositive) {
            const result  = mission.getAsPositive();
            type = result.operation;
            value = result.reward;
        }
        else {
            type = mission.operation;
            value = mission.reward;
        }
        switch (type) {
            case "multiplier":
                reward *= value;
                break;

            case "add":
                reward += value;
                break;
        }

        return reward;
    }

    #getMarginalPickupReward(parcel, belief) {
        const carried = belief.parcels.filter(
            p => p.carriedBy === belief.me.id
        );

        const scoreMissions = belief.getDeliveryScoreOverrideMissions();

        const before = this.#getSummedReward(carried, scoreMissions);

        const after = this.#getSummedReward([...carried, parcel], scoreMissions);

        return after - before;
    }

}

export { Desires };