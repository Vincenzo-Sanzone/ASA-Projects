import { Plan } from "./planner.js";
import { Logger, Movement, Strategy, executeUntilDone } from "../../utility/index.js";
import { GoToPlan } from "./go-to.js";

/**
 * Plan to deliver all carried parcels at a delivery point.
 * First moves to the delivery point, then emits the deliver action for each parcel.
 */
class DeliverPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("DeliverPlan:", intention.beliefs.me.name);
    }

    static isApplicable(action) {
        return action === 'deliver';
    }

    stop() {
        super.stop();
        this.goTo.stop();
    }

    async execute() {
        const carriedParcels = this.intention.beliefs.parcels.filter(p => p.carriedBy === this.intention.beliefs.me.id);
        if (carriedParcels.length === 0) {
            return false
        };
        const myNearest = Movement.nearestDeliveryPoint(this.intention.beliefs.config?.map, { x: this.intention.beliefs.me?.x, y: this.intention.beliefs.me?.y }, this.intention.beliefs.enemies, this.intention.beliefs.getDeliveryLocationMissions());
        const newEnemis = [...this.intention.beliefs.enemies, this.intention.beliefs.me].filter(e => e.id !== this.intention.beliefs.teammate);
        const teammate = this.intention.beliefs.getTeammate();
        let teammateNearest = null;
        if (teammate !== undefined) teammateNearest = Movement.nearestDeliveryPoint(this.intention.beliefs.config?.map, { x: teammate.x, y: teammate.y }, newEnemis, this.intention.beliefs.getDeliveryLocationMissions());
        if ((this.intention.beliefs.thereIsCrossAgent() && !carriedParcels.some(p => p.pickedByTeammate)) || (myNearest === null && teammateNearest !== null)) {
            return await this.#giveParcelsToTeammate(teammate, newEnemis);
        }
        return await this.#normalDelivery(myNearest);

    }

    async #normalDelivery(result) {
        // Calculate the nearest delivery point from my position
        if (result === null) return false;

        const { x, y } = result;
        this.logger.debug(`Delivering at (${x}, ${y})`);
        // Step 1: Move to the delivery point
        await this.goTo.execute(x, y);
        if (this.stopped) return false;

        // Deliver all carried parcels, if we are still carrying some and we are on a delivery tile
        if (this.intention.beliefs.parcels.some(p => p.carriedBy === this.intention.beliefs.me.id) && this.intention.beliefs.me.x === x && this.intention.beliefs.me.y === y) {
            this.logger.info(`Delivering all carried parcels`);
            await executeUntilDone(() => this.socket.emitPutdown())
            this.intention.beliefs.removeDeliveredParcel();
        }
        else {
            this.logger.debug(`We are not on a delivery tile or we are not carrying any parcels, skipping delivery`);
        }

        return true;
    }

    async #giveParcelsToTeammate(teammate, teammateEnemies) {
        // Move to a tile with at least 2 bidirectional neighbours
        const tile = Strategy.findTileAccessible(this.intention.beliefs.config?.map, this.intention.beliefs.me, teammate, this.intention.beliefs.enemies, teammateEnemies);
        if (tile === null) {
            return false;
        }
        // Start moving near the tile
        await this.goTo.execute(tile.x, tile.y);
        if (this.stopped) {
            return false;
        }
        if (this.intention.beliefs.me.x === tile.x && this.intention.beliefs.me.y === tile.y) {
            this.intention.beliefs.waiting = true
            await this.intention.beliefs.coordinator.sendMeetAt(tile);
        }
    
        return true
    }
}

export { DeliverPlan };