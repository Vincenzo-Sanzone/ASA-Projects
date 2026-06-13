import { Logger, Mission, TYPE_MISSION, Coordinator } from "../../utility/index.js";
import { MissionParser } from "../llm/mission.js";
import { BDIAgent } from "../../bdi-agent/index.js";

class LevelTwoSolver {

    /**
     * 
     * @param {MissionParser} parser 
     * @param {BDIAgent} bdi 
     */
    constructor(parser, bdi) {
        this.parser = parser;
        this.tools = {
            deliveryStackMultiplier: this.#deliveryStackMultiplier,
            deliveryLocationMultiplier: this.#deliveryLocationMultiplier,
            deliveryScoreOverride: this.#deliveryScoreOverride,
            movementTilePoints: this.#movementTilePoints
        };
        this.bdi = bdi;

        this.logger = new Logger("LevelTwoSolver:");
    }

    async solvePersistent(message) {
        const response = await this.parser.solveLevelTwo(message);
        console.log("[DEBUG] Solving peristent mission", JSON.stringify(response, null, 2));

        if (this.tools[response.action] === undefined) this.logger.error(`Unknown tool: ${response.action}`);

        const mission = this.tools[response.action](response);

        if (mission === undefined) this.logger.error(`Didn't get a mission from the tool: ${response.action}`);

        if (response.action === TYPE_MISSION.DELIVERY_LOCATION || response.action === TYPE_MISSION.MOVEMENT_TILE) {
            for (const m of mission) {
                m.reward = response.rewards;
                this.bdi.coordinator.sendMission(m);
                this.bdi.belief.addMission(m);
            }
        }
        else { 
            mission.reward = response.rewards; 
            this.bdi.coordinator.sendMission(mission);
            this.bdi.belief.addMission(mission);
        }
    }

    #deliveryStackMultiplier(response) {
        if (response.size === undefined || (response.multiplier === undefined && response.bonus === undefined)) return undefined;
        if (response.multiplier)
            return new Mission(TYPE_MISSION.DELIVERY_STACK, true, { size: response.size, multiplier: response.multiplier });
        else return new Mission(TYPE_MISSION.DELIVERY_STACK, true, { size: response.size, bonus: response.bonus });
    }

    #deliveryLocationMultiplier(response) {
        if (response.location === undefined || (response.multiplier === undefined && response.bonus === undefined)) return undefined;

        const missions = [];
        for (let i = 0; i < response.location.length; i += 2) {
            if (response.multiplier)
                missions.push(new Mission(TYPE_MISSION.DELIVERY_LOCATION, true, { x: eval(response.location[i]), y: eval(response.location[i + 1]), multiplier: response.multiplier }));
            else
                missions.push(new Mission(TYPE_MISSION.DELIVERY_LOCATION, true, { x: eval(response.location[i]), y: eval(response.location[i + 1]), bonus: response.bonus }));

        }
        return missions
    }

    #deliveryScoreOverride(response) {
        if (response.operator === undefined || response.score === undefined || (response.multiplier === undefined && response.bonus === undefined)) return undefined;
        if (response.multiplier)
            return new Mission(TYPE_MISSION.DELIVERY_SCORE, true, { operator: response.operator, score: response.score, multiplier: response.multiplier });
        else return new Mission(TYPE_MISSION.DELIVERY_SCORE, true, { operator: response.operator, score: response.score, bonus: response.bonus });
    }

    #movementTilePoints(response) {
        if (response.location === undefined || (response.bonus === undefined && response.multiplier === undefined)) return undefined;
        const missions = [];
        for (let i = 0; i < response.location.length; i += 2) {
            if (response.multiplier)
                missions.push(new Mission(TYPE_MISSION.MOVEMENT_TILE, true, { x: eval(response.location[i]), y: eval(response.location[i + 1]), multiplier: response.multiplier }));
            else missions.push(new Mission(TYPE_MISSION.MOVEMENT_TILE, true, { x: eval(response.location[i]), y: eval(response.location[i + 1]), bonus: response.bonus }));
        }
        return missions
    }

}

export { LevelTwoSolver };