import { BDIAgent } from "../../bdi-agent/index.js";
import { Logger } from "../../utility/index.js";
import { MissionParser } from "../llm/mission.js";
import { LevelOneSolver } from "./level-one.js";
import { LevelTwoSolver } from "./level-two.js";
import { LevelThreeSolver } from "./level-three.js";

class Strategy {
    /**
     * 
     * @param {BDIAgent} bdi 
     */
    constructor(bdi, caller) {
        this.bdi = bdi;
        this.parser = new MissionParser(caller);
        this.logger = new Logger("Strategy:");
    }


    async solve(message) {
        const missionLevel = (await this.parser.route(message)).type

        if (missionLevel === "TYPE_1") await new LevelOneSolver(this.parser, this.bdi).solveAtomic(message)
        else if (missionLevel === "TYPE_2") await new LevelTwoSolver(this.parser, this.bdi).solvePersistent(message)
        else if (missionLevel === "TYPE_3") await new LevelThreeSolver(this.parser, this.bdi).solveCoordination(message) 
        else this.logger.error(`Mission parser answered with unknown mission level: ${missionLevel}`);
    }
    
}

export { Strategy };