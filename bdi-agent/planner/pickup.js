import { Plan } from "./planner.js";
import { Logger, executeUntilDone } from "../../utility/index.js";
import { GoToPlan } from "./go-to.js";

/**
 * Plan to pick up a specific parcel.
 * First moves to the parcel, then emits the pickup action.
 */
class PickUpPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("PickUpPlan:", intention.beliefs.me.name);
    }

    static isApplicable(action, id) {
        return action === 'pickup' && id !== undefined;
    }

    stop() {
        super.stop();
        this.goTo.stop();
    }

    async execute(id) {
        const { x, y, reward } = this.intention.beliefs.parcels.filter(p => p.id === id)[0];
        this.logger.debug(`Picking up parcel ${id} at (${x}, ${y}) with reward ${reward}`);
        // Step 1: Move to the parcel
        await this.goTo.execute(x, y);
        if (this.stopped) return false;

        this.logger.info(`Emitting pickup parcel ${id}`);
        // Step 2: Pick up the parcel
        await executeUntilDone(() => this.socket.emitPickup());
        return true;
    }
}

export { PickUpPlan };