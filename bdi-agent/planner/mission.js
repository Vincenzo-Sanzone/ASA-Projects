import { Plan } from "./planner.js";
import { Logger, executeUntilDone, Mission, Movement, Strategy } from "../../utility/index.js";
import { GoToPlan } from "./go-to.js";

/**
 * Plan to solve a specific mission.
 */
class MissionPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("MissionPlan:");
    }

    static isApplicable(action, mission) {
        return action === 'mission' && mission !== undefined;
    }

    stop() {
        super.stop();
        this.goTo.stop();
    }

    /**
     * 
     * @param {Mission} mission 
     * @returns 
     */
    async execute(mission) {
        this.logger.debug(`Solving mission ${mission.type}`);

        if (mission.type === "move") await this.goTo.execute(mission.args.x, mission.args.y);
        else if (mission.type === "drop") {
            const {x, y} = Strategy.getDeliveryWithCoordinate(this.intention.beliefs.config.map, this.intention.beliefs.me, mission.args); 
            if (x === null || y === null) return false;
            await this.goTo.execute(x, y);
            if (this.stopped) return false;
            await executeUntilDone(() => this.socket.emitPutdown());
        }
        if (this.stopped) return false;

        this.intention.beliefs.removeMission(mission);
        return true;
    }
}

export { MissionPlan };