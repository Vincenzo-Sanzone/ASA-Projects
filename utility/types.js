class Agent {
    /**
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOAgent} sensedAgent - The agent data received from sensing.
     */
    constructor(sensedAgent, last = null) {
        this.id = sensedAgent.id;
        this.name = sensedAgent.name;
        this.x = sensedAgent.x;
        this.y = sensedAgent.y;
        this.timestampSeen = Date.now();
        this.last = last
    }
}

class Parcel {

    /**
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOParcel} sensedParcel - The parcel data received from sensing.
     */
    constructor(sensedParcel) {
        this.id = sensedParcel.id;
        this.x = sensedParcel.x;
        this.y = sensedParcel.y;
        this.reward = sensedParcel.reward;
        this.carriedBy = sensedParcel.carriedBy;
        this.timestampSeen = Date.now();
        this.pickedByMe = false
        this.pickedByTeammate = false
    }
}

class Crates {
    /**
     * @param {*} sensedCrate - The crate data received from sensing.
     */
    constructor(sensedCrate) {
        this.id = sensedCrate.id;
        this.x = sensedCrate.x;
        this.y = sensedCrate.y;
    }
}

class GameMap {
    /**
     * @param {import("@unitn-asa/deliveroo-js-sdk/types/IOGameOptions.js").IOMapOptions} maps - The map data received from the server configuration.
     */
    constructor(maps) {
        this.width = maps.tiles.length;
        this.height = maps.tiles[0].length;
        this.tiles = maps.tiles;
    }

    printFullMap(){
        let map = '';
        console.log(`Map size: ${this.width}x${this.height}`);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                map += this.tiles[x][y] + ' ';
            }
            map += '\n';
        }
    }
}

class GameConfig {

    /**
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOConfig} settings - The configuration settings from the server.
     */
    constructor(settings) {
        this.clock = settings.CLOCK;
        this.map = new GameMap(settings.GAME.map);
        this.maxParcels = settings.GAME.parcels.max;
        this.capacity = Math.min(settings.GAME.player.capacity, settings.GAME.parcels.max);
        this.decayEvent = settings.GAME.parcels.decaying_event;
        this.generationEvent = settings.GAME.parcels.generation_event;
        this.average = settings.GAME.parcels.reward_avg;
        this.variance = settings.GAME.parcels.reward_variance;
        this.observationDistance = settings.GAME.player.observation_distance; 
    }
}

class Mission {
    constructor(type, persistent, operation = "add", reward = 0, args = {}) {
        this.type = type;
        this.persistent = persistent
        this.operation = operation
        this.reward = reward
        this.args = args
    }

    isNegative(){
        return (this.operation === "add" && this.reward < 0) || (this.operation === "multiplier" && this.reward < 1);
    }

    getAsPositive() {
        if (!this.isNegative()) return {operation: this.operation, reward: this.reward};

        if (this.operation === "add") return {operation: this.operation, reward: Math.abs(this.reward)}
        else return {operation: this.operation, reward: this.reward + 1}
    }

    static fromJSON(json) {
    return new Mission(
        json.type,
        json.persistent,
        json.operation,
        json.reward,
        json.args
    );
}
}

const TYPE_MISSION = Object.freeze({
    MOVE: "move",
    DROP: "drop",
    DELIVERY_STACK: "deliveryStackMultiplier",
    DELIVERY_LOCATION: "deliveryLocationMultiplier",
    DELIVERY_SCORE: "deliveryScoreOverride",
    MOVEMENT_TILE: "movementTilePoints",
    MOVE_NEAR: "moveNear",
    CROSS_AGENT: "crossAgent",
    RED_GREEN_LIGHT: "redGreenLight"

});

export { Agent, Parcel, Crates, GameMap, GameConfig, Mission, TYPE_MISSION };