import { Plan, GoToPlan } from "./planner.js";
import { Logger } from "../../utility/index.js";

/**
 * Plan to pick up a specific parcel.
 * First moves to the parcel, then emits the pickup action.
 */
class PickUpPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.logger = new Logger("PickUpPlan:");
    }

    static isApplicable(action, id) {
        return action === 'pickup' && id !== undefined;
    }

    async execute(id) {
        const { x, y, reward } = this.intention.beliefs.parcels.filter(p => p.id === id)[0];
        this.logger.info(`Picking up parcel ${id} at (${x}, ${y}) with reward ${reward}`);
        // Step 1: Move to the parcel
        await new GoToPlan(this.intention, this.socket).execute(x, y);
        if (this.stopped) return false;

        this.logger.info(`Emitting pickup parcel ${id}`);
        // Step 2: Pick up the parcel
        await this.socket.emitPickup();
        return true;
    }
}

export { PickUpPlan };