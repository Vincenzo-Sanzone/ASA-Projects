import { Plan } from "./planner.js";
import { Logger, Movement, executeUntilDone } from "../../utility/index.js";
import { GoToPlan } from "./go-to.js";

/**
 * Plan to deliver all carried parcels at a delivery point.
 * First moves to the delivery point, then emits the deliver action for each parcel.
 */
class DeliverPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("DeliverPlan:");
    }

    static isApplicable(action) {
        return action === 'deliver';
    }

    stop() {
        super.stop();
        this.goTo.stop();
    }

    async execute() {
        // Calculate the nearest delivery point from my position
        const { x, y } = Movement.nearestDeliveryPoint(this.intention.beliefs.config?.map, { x: this.intention.beliefs.me?.x, y: this.intention.beliefs.me?.y });
        this.logger.debug(`Delivering at (${x}, ${y})`);
        // Step 1: Move to the delivery point
        await this.goTo.execute(x, y);
        if (this.stopped) return false;

        // Deliver all carried parcels, if we are still carrying some and we are on a delivery tile
        if (this.intention.beliefs.parcels.some(p => p.carriedBy === this.intention.beliefs.me.id) && this.intention.beliefs.me.x === x && this.intention.beliefs.me.y === y) {
            this.logger.info(`Delivering all carried parcels`);
            await executeUntilDone(() => this.socket.emitPutdown())
            this.intention.beliefs.removeCarriedParcel();
        }
        else {
            this.logger.debug(`We are not on a delivery tile or we are not carrying any parcels, skipping delivery`);
        }

        return true;
    }
}

export { DeliverPlan };