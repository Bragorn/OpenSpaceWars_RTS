class TelemetryCollector {
    constructor() {
        this.reset();
    }

    reset() {
        this.summary = {
            team1: this.createTeamObject(),
            team2: this.createTeamObject()
        };
    }

    createTeamObject() {
        return {
            shipsSpawned: 0,
            shipsLost: 0,
            shipsKilled: 0,
            damageDealt: 0,
            damageReceived: 0,
            planetsCaptured: 0,
            upgrades: 0
        };
    }

    logEvent(type, teamId, details = {}) {
        const team = this.summary[`team${teamId}`];
        if (!team) return;

        switch (type) {
            case 'SHIP_SPAWN':       team.shipsSpawned++; break;
            case 'SHIP_DESTROYED':   team.shipsLost++; break;
            case 'SHIP_KILLED':      team.shipsKilled++; break;
            case 'PLANET_CAPTURE':   team.planetsCaptured++; break;
            case 'PLANET_UPGRADE':   team.upgrades++; break;
            case 'DAMAGE_DEALT':     team.damageDealt += details.amount; break;
            case 'DAMAGE_RECEIVED':  team.damageReceived += details.amount; break;
        }
    }
}