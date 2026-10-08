class TelemetryCollector {
    constructor() {
        this.reset();
    }

    reset() {
        this.summary = {
            team1: { shipsSpawned: 0, shipsLost: 0, shipsKilled: 0, planetsCaptured: 0, upgrades: 0 },
            team2: { shipsSpawned: 0, shipsLost: 0, shipsKilled: 0, planetsCaptured: 0, upgrades: 0 }
        };
    }

    logEvent(gameTime, type, teamId) {
        const key = `team${teamId}`;
        if (!this.summary[key]) return;

        if (type === 'SHIP_SPAWN') {
            this.summary[key].shipsSpawned++;
        } else if (type === 'SHIP_DESTROYED') {
            this.summary[key].shipsLost++;
        } else if (type === 'SHIP_KILLED') {
            this.summary[key].shipsKilled++;
        } else if (type === 'PLANET_CAPTURE') {
            this.summary[key].planetsCaptured++;
        } else if (type === 'PLANET_UPGRADE') {
            this.summary[key].upgrades++;
        }
    }

    getSummary() {
        return this.summary;
    }
}

if (typeof window !== 'undefined') {
    window.TelemetryCollector = TelemetryCollector;
}