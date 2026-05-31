class Agent {
    /**
     * @param {import("@unitn-asa/deliveroo-js-sdk").IOAgent} sensedAgent - The agent data received from sensing.
     */
    constructor(sensedAgent) {
        this.id = sensedAgent.id;
        this.x = sensedAgent.x;
        this.y = sensedAgent.y;
        this.timestampSeen = Date.now();
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
    }
}

class GameMap {
    /**
     * @param {import("@unitn-asa/deliveroo-js-sdk/types/IOGameOptions.js").IOMapOptions} maps - The map data received from the server configuration.
     */
    constructor(maps) {
        this.width = maps.tiles[0].length;
        this.height = maps.tiles.length;
        this.tiles = maps.tiles;
        // At the moment tiles is an array of columns, but it would be more intuitive to have it as an array of rows. Let's transpose it for easier access.
        //this.tiles = this.transposeTiles(this.tiles);
        //this.printFullMap();
    }

    transposeTiles(tiles) {
        const transposed = [];
        for (let y = 0; y < this.height; y++) {
            transposed[y] = [];
            for (let x = 0; x < this.width; x++) {
                transposed[y][x] = tiles[x][this.height - y];
                console.log(`Tile at (${x}, ${y}): ${tiles[x][this.height - y - 1]}`);
            }
        }
        return transposed;
    }

    printFullMap(){
        const mapString = this.tiles.map(row => row.join(" ")).join("\n");
        console.log(this.tiles[0][16])
        console.log("🗺️ Mappa:\n" + mapString);
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
    }
}

export { Agent, Parcel, GameMap, GameConfig };