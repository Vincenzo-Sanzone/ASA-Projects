import { Plan } from "./planner.js";
import { Logger, executeUntilDone, Mission, Movement, Strategy, TYPE_MISSION } from "../../utility/index.js";
import { GoToPlan } from "./go-to.js";

/**
 * Plan to solve a specific mission.
 */
class MissionPlan extends Plan {
    constructor(intention, socket) {
        super(intention, socket);
        this.goTo = new GoToPlan(this.intention, this.socket);
        this.logger = new Logger("MissionPlan:", intention.beliefs.me.name);
    }

    static isApplicable(action, mission) {;
        if (action !== 'mission') return false;

        return mission !== undefined && mission.type === TYPE_MISSION.MOVE || 
        mission.type === TYPE_MISSION.DROP || mission.type === TYPE_MISSION.MOVE_NEAR || 
        mission.type === TYPE_MISSION.RED_GREEN_LIGHT
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
        this.logger.info(`Solving mission ${mission.type}`);

        if (mission.type === TYPE_MISSION.MOVE) await this.goTo.execute(mission.args.x, mission.args.y);
        else if (mission.type === TYPE_MISSION.DROP) await this.#drop(mission.args);
        else if (mission.type === TYPE_MISSION.MOVE_NEAR) await this.#moveNear(mission.args);
        else if (mission.type === TYPE_MISSION.RED_GREEN_LIGHT) await this.#playRedGreenLight(mission.args);
        
        if (this.stopped) return false;

        if (!mission.persistent) this.intention.beliefs.removeMission(mission);
        
        return true;
    }

    async #drop(args) {
        const { x, y } = Strategy.getDeliveryWithCoordinate(this.intention.beliefs.config.map, this.intention.beliefs.me, args);
        if (x === null || y === null) return false;
        await this.goTo.execute(x, y);
        if (this.stopped) return false;
        await executeUntilDone(() => this.socket.emitPutdown());
    }

    async #moveNear(args) {
        const targetX = args.x
        const targetY = args.y
        const maximumDistance = args.distance

        const allPossibleTiles = Strategy.getAllPossibleTiles(this.intention.beliefs.config.map, { x: targetX, y: targetY }, maximumDistance);
        const closestTile = allPossibleTiles.reduce((best, tile) => {
            if (!best) return tile;

            const d1 = Movement.getDistance(this.intention.beliefs.config?.map, this.intention.beliefs.me, tile, this.intention.beliefs.enemies);
            const d2 = Movement.getDistance(this.intention.beliefs.config?.map, this.intention.beliefs.me, best, this.intention.beliefs.enemies);

            return d1 < d2 ? tile : best;
        }, null);
        if (closestTile === null) return false;

        await this.goTo.execute(closestTile.x, closestTile.y);

        if (this.stopped) return false;
        this.intention.beliefs.waiting = true;
        if (this.intention.beliefs.isMyTeammateWaiting) {
            await this.intention.beliefs.coordinator.sendDone();
            this.intention.beliefs.isMyTeammateWaiting = false;
            this.intention.beliefs.waiting = false;
        }
        else await this.intention.beliefs.coordinator.sendWaitingNearTarget();
    }

    async #playRedGreenLight(args) {
        const isXOdd = args.xOdd
        const isYOdd = args.yOdd
        if (isXOdd === null && isYOdd === null) {
            this.intention.beliefs.waiting = true;
            return true;
        }
        let imXOdd = this.intention.beliefs.me.x % 2 === 1;
        let imYOdd = this.intention.beliefs.me.y % 2 === 1;
        let needToMove = false;
        if (isXOdd !== null && imXOdd !== isXOdd) {
            needToMove = true;
        }
        if (isYOdd !== null && isYOdd !== imYOdd) {
            needToMove = true;
        }
        if (!needToMove) {
            this.intention.beliefs.waiting = true;
            return true;
        }
        const tile = Strategy.findTileWith(this.intention.beliefs.config.map, this.intention.beliefs.me, isXOdd, isYOdd, this.intention.beliefs.enemies);
        await this.goTo.execute(tile.x, tile.y);
        if (this.stopped) return false;
        this.intention.beliefs.waiting = true;
        return true;
    }
}

export { MissionPlan };