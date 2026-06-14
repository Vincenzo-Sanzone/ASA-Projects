import { Plan } from "./planner.js";
import { Logger, Movement, Strategy, executeUntilDone } from "../../utility/index.js";
import { GoToPlan } from "./go-to.js";

/**
 * Plan to meet with teammate at a specific (x, y) coordinate.
 */
class MeetAtPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("MeetAt:", intention.beliefs.me.name);
    }

    static isApplicable(action) {
        console.log("[DEBUG] MeetAtPlan.isApplicable", action);
        return action === 'meet';
    }

    stop() {
        super.stop();
        this.goTo.stop();
    }

    async execute() {
        console.log("[DEBUG] Plan Meeting with teammate at",this.intention.beliefs.meetAt,  this.intention.beliefs.me.name);
        if (this.intention.beliefs.meetAt === null) {
            console.log("[DEBUG] Plan Meeting with teammate at is null", this.intention.beliefs.me.name);
            return false;
        }
        const { x, y } = Strategy.findNearest(this.intention.beliefs.config?.map, { x: this.intention.beliefs.me.x, y: this.intention.beliefs.me.y }, this.intention.beliefs.meetAt, this.intention.beliefs.enemies);
        
        console.log("[DEBUG] Going to ", x, y, this.intention.beliefs.me.name);
        await this.goTo.execute(x, y);
        console.log("[DEBUG] Arrived to ", x, y, this.intention.beliefs.me.name);
        if (this.stopped) return false;

        if (Movement.getDistance(this.intention.beliefs.config?.map, this.intention.beliefs.me, this.intention.beliefs.meetAt) <= 1) {
            console.log("[DEBUG] Now i am at",this.intention.beliefs.me.x, this.intention.beliefs.me.y,  this.intention.beliefs.me.name);
            await this.intention.beliefs.coordinator.sendDone();
            this.intention.beliefs.meetAt = null;
            // sleep 500 ms
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return true
    }
}

export { MeetAtPlan };