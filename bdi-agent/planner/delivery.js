import { Plan, GoToPlan } from "./planner.js";
import { Logger, Movement } from "../../utility/index.js";

/**
 * Plan to deliver all carried parcels at a delivery point.
 * First moves to the delivery point, then emits the deliver action for each parcel.
 */
class DeliverPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.logger = new Logger("DeliverPlan:");
    }

    static isApplicable(action, x, y, id) {
        return action === 'deliver' && x !== undefined && y !== undefined;
    }

    async execute() {
        // Calculate the nearest delivery point from my position
        const {x,y} = Movement.nearestDeliveryPoint(this.intention.beliefs.config?.map, {x: this.intention.beliefs.me?.x, y: this.intention.beliefs.me?.y});
        this.logger.info(`Delivering at (${x}, ${y})`);
        // Step 1: Move to the delivery point
        await new GoToPlan(this.intention, this.socket).execute(x, y);
        if (this.stopped) return false;

        this.logger.info(`Delivering all carried parcels`);
        // Step 2: Deliver all carried parcels
        await this.socket.emitPutdown();
        
        return true;
    }
}

export { DeliverPlan };