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

        this.logger = new Logger("LevelTwoSolver:", bdi.belief.me.name);
    }

    async solvePersistent(message) {
        const response = await this.parser.solveLevelTwo(message);

        if (this.tools[response.action] === undefined) this.logger.error(`Unknown tool: ${response.action}`);

        const mission = this.tools[response.action](response);

        if (mission === undefined) this.logger.error(`Didn't get a mission from the tool: ${response.action}`);

        if (response.action === TYPE_MISSION.DELIVERY_LOCATION || response.action === TYPE_MISSION.MOVEMENT_TILE) {
            for (const m of mission) {
                await this.bdi.coordinator.sendMission(m);
                this.bdi.belief.addMission(m);
            }
        }
        else { 
            await this.bdi.coordinator.sendMission(mission);
            this.bdi.belief.addMission(mission);
        }
    }

    #deliveryStackMultiplier(response) {
        if (response.size === undefined || (response.multiplier === undefined && response.reward === undefined)) return undefined;
        if (response.multiplier)
            return new Mission(TYPE_MISSION.DELIVERY_STACK, true, "multiplier", response.multiplier, { size: response.size});
        else return new Mission(TYPE_MISSION.DELIVERY_STACK, true, "add", response.reward, { size: response.size });
    }

    #deliveryLocationMultiplier(response) {
        if (response.location === undefined || (response.multiplier === undefined && response.reward === undefined)) return undefined;

        const missions = [];
        for (let i = 0; i < response.location.length; i += 2) {
            if (response.multiplier)
                missions.push(new Mission(TYPE_MISSION.DELIVERY_LOCATION, true, "multiplier", response.multiplier, { x: eval(response.location[i]), y: eval(response.location[i + 1]) }));
            else
                missions.push(new Mission(TYPE_MISSION.DELIVERY_LOCATION, true, "add", response.reward, { x: eval(response.location[i]), y: eval(response.location[i + 1]) }));

        }
        return missions
    }

    #deliveryScoreOverride(response) {
        if (response.operator === undefined || response.score === undefined || (response.multiplier === undefined && response.reward === undefined)) return undefined;
        if (response.multiplier)
            return new Mission(TYPE_MISSION.DELIVERY_SCORE, true, "multiplier", response.multiplier, { operator: response.operator, score: response.score });
        else return new Mission(TYPE_MISSION.DELIVERY_SCORE, true, "add", response.reward, { operator: response.operator, score: response.score });
    }

    #movementTilePoints(response) {
        if (response.location === undefined || (response.reward === undefined && response.multiplier === undefined)) return undefined;
        const missions = [];
        for (let i = 0; i < response.location.length; i += 2) {
            if (response.multiplier)
                missions.push(new Mission(TYPE_MISSION.MOVEMENT_TILE, true, "multiplier", response.multiplier, { x: eval(response.location[i]), y: eval(response.location[i + 1]) }));
            else missions.push(new Mission(TYPE_MISSION.MOVEMENT_TILE, true, "add", response.reward, { x: eval(response.location[i]), y: eval(response.location[i + 1]) }));
        }
        return missions
    }

}

export { LevelTwoSolver };