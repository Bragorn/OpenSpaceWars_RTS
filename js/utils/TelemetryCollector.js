class TelemetryCollector {
    constructor() {
        this.reset();
    }

    reset() {
        this.summary = {
            team1: this.createTeamObject(),
            team2: this.createTeamObject()
        };
        this.firstCaptureTime = null;
        this.contestedTimeTotal = 0;
    }

    createTeamObject() {
        return {
            shipsSpawned: 0,
            shipsLost: 0,
            shipsKilled: 0,
            combatParticipants: 0,
            damageDealt: 0,
            damageReceived: 0,
            planetsCaptured: 0,
            upgrades: 0,
            transitTimeTotal: 0,
            orbitTimeTotal: 0,
            idleShipSamples: 0,
            activeShipSamples: 0,
            dispatchSizes: [],
            expansionTimestamps: {},
            majorityTime: 0,
            wasBelow30Percent: false
        };
    }

    addContestedTime(dt) {
        this.contestedTimeTotal += dt;
    }

    logEvent(gameTime, type, teamId, details = {}) {
        const key = `team${teamId}`;
        const team = this.summary[key];
        if (!team) return;

        if (type === 'SHIP_SPAWN') {
            team.shipsSpawned++;
        } else if (type === 'SHIP_DESTROYED') {
            team.shipsLost++;
        } else if (type === 'SHIP_KILLED') {
            team.shipsKilled++;
        } else if (type === 'PLANET_CAPTURE') {
            team.planetsCaptured++;
            if (this.firstCaptureTime === null) {
                this.firstCaptureTime = gameTime;
            }
        } else if (type === 'PLANET_UPGRADE') {
            team.upgrades++;
        } else if (type === 'DAMAGE_DEALT') {
            team.damageDealt += details.amount || 0;
        } else if (type === 'DAMAGE_RECEIVED') {
            team.damageReceived += details.amount || 0;
        } else if (type === 'COMBAT_PARTICIPANT') {
            team.combatParticipants++;
        } else if (type === 'DISPATCH') {
            if (details.ratio !== undefined) {
                team.dispatchSizes.push(details.ratio);
            }
        } else if (type === 'EXPANSION') {
            if (details.planetCount && !team.expansionTimestamps[details.planetCount]) {
                team.expansionTimestamps[details.planetCount] = Math.round(gameTime * 10) / 10;
            }
        }
    }

    updateTickMetrics(dt, gameManager) {
        if (!gameManager || !gameManager.isRunning) return;

        const totalPlanets = gameManager.planets.length || 1;
        const t1Planets = gameManager.planets.filter(p => p.owner === 1).length;
        const t2Planets = gameManager.planets.filter(p => p.owner === 2).length;

        // Majority Control Duration Tracking
        if (t1Planets / totalPlanets > 0.5) this.summary.team1.majorityTime += dt;
        if (t2Planets / totalPlanets > 0.5) this.summary.team2.majorityTime += dt;

        // Comeback Flag Tracking (<30% planet ownership)
        if (t1Planets / totalPlanets < 0.3) this.summary.team1.wasBelow30Percent = true;
        if (t2Planets / totalPlanets < 0.3) this.summary.team2.wasBelow30Percent = true;

        // Ship State Tracking
        gameManager.ships.forEach(s => {
            if (!s || s.dead) return;
            const team = this.summary[`team${s.owner}`];
            if (!team) return;

            if (s.state === 'moving' || s.state === 'launching' || s.state === 'insertion') {
                team.transitTimeTotal += dt;
            } else if (s.state === 'orbit') {
                team.orbitTimeTotal += dt;
                
                // Idle fleet ratio: orbiting friendly planet with valid targets existing
                const hasEnemyTargets = gameManager.planets.some(p => p.owner !== s.owner);
                if (hasEnemyTargets && s.orbitPlanet && s.orbitPlanet.owner === s.owner) {
                    team.idleShipSamples += dt;
                }
            }
            team.activeShipSamples += dt;
        });
    }

    getSummary() {
        return {
            teams: this.summary,
            firstCaptureTime: this.firstCaptureTime !== null ? Math.round(this.firstCaptureTime) : null,
            contestedTimeTotal: Math.round(this.contestedTimeTotal)
        };
    }
}

if (typeof window !== 'undefined') {
    window.TelemetryCollector = TelemetryCollector;
}