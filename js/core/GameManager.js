class GameManager {
    constructor(isHeadless = false) {
        this.isHeadless = isHeadless;
        this.planets = [];
        this.ships = [];
        this.explosions = [];
        this.frameStats = { orbiting: new Map(), teamShips: {} };

        this.telemetry = new TelemetryCollector();
        this.gameMode = 'PLAYER_VS_CPU';

        this.factionMap = {
            0: 'NEUTRAL',
            1: 'REMNANTS',
            2: 'PROTOCOL'
        };

        this.canvas = !this.isHeadless ? document.getElementById('game') : null;
        this.renderer = !this.isHeadless ? new Renderer(this.canvas) : null;
        this.controls = null;
        this.aiController1 = null;
        this.aiController2 = null;

        this.isRunning = false;
        this.gameTime = 0;
        this.accumulator = 0;
        this.gameSpeed = window.GAME_CONFIG.DEFAULT_SPEED;

        this.winnerId = null;
        this.onGameOver = null; // the UI sets this to show the game-over popup
    }

    setFactionMap(team1FactionKey, team2FactionKey) {
        this.factionMap = {
            0: 'NEUTRAL',
            1: team1FactionKey || 'REMNANTS',
            2: team2FactionKey || 'PROTOCOL'
        };
    }

    setSpeed(speed) {
        this.gameSpeed = speed;
    }

    start(mapData, team1FactionKey, team2FactionKey, gameMode = 'PLAYER_VS_CPU') {
        this.reset();
        this.gameMode = gameMode;
        this.setFactionMap(team1FactionKey, team2FactionKey);

        if (this.gameMode === 'CPU_VS_CPU') {
            this.aiController1 = new AIController(this, 1);
            this.aiController2 = new AIController(this, 2);
        } else {
            this.aiController1 = null;
            this.aiController2 = new AIController(this, 2);
        }
        this.setupControls();

        this.loadMap(mapData);
        this.isRunning = true;
        this.setSpeed(window.GAME_CONFIG.DEFAULT_SPEED);
    }

    setupControls() {
        if (this.isHeadless) {
            this.controls = null;
            return;
        }
        if (!this.controls) this.controls = new Controls(this.canvas, this, 1);
        this.controls.reset();
        this.controls.enabled = (this.gameMode !== 'CPU_VS_CPU');
    }

    stop() {
        this.isRunning = false;
    }

    reset() {
        this.planets = [];
        this.ships = [];
        this.explosions = [];
        this.frameStats = { orbiting: new Map(), teamShips: {} };
        this.gameTime = 0;
        this.accumulator = 0;
        this.winnerId = null;

        if (this.telemetry) {
            this.telemetry.reset();
        }
    }

    loadMap(mapData) {
        this.ships = [];
        this.planets = mapData.planets.map(p => new Planet(p.x, p.y, p.level, p.owner));
    }

    playSound(id, opts) {
        if (this.isHeadless) return;
        AudioManager.play(id, opts);
    }

    spawnShip(sourcePlanet, targetPlanet) {
        if (!sourcePlanet) return null;
        const ship = new Ship(sourcePlanet, targetPlanet || sourcePlanet, this);
        this.ships.push(ship);

        if (this.telemetry && sourcePlanet.owner) {
            this.telemetry.logEvent(this.gameTime, 'SHIP_SPAWN', sourcePlanet.owner);
        }

        return ship;
    }

    spawnExplosion(x, y) {
        if (this.isHeadless) return; // the batch sim doesn't need visuals
        this.explosions.push({ x, y, age: 0 });
    }

    dispatchFleet(sourcePlanet, targetPlanet, ratio) {
        if (!sourcePlanet || !targetPlanet || sourcePlanet === targetPlanet) return;

        const availableShips = this.ships.filter(s =>
            s && !s.dead &&
            s.owner === sourcePlanet.owner &&
            (s.targetPlanet === sourcePlanet || s.orbitPlanet === sourcePlanet) &&
            (s.state === 'orbit' || s.state === 'surface_launch')
        );

        if (availableShips.length === 0) return;

        const count = Math.max(1, Math.floor(availableShips.length * ratio));
        const fleet = availableShips.slice(0, count);

        fleet.forEach(ship => {
            ship.orbitPlanet = sourcePlanet;
            ship.targetPlanet = targetPlanet;
            ship.state = 'launching';
            ship.launchProgress = 0;
        });
    }

    refreshFrameStats() {
        const orbiting = new Map();
        const teamShips = {};
        for (let i = 0; i < this.ships.length; i++) {
            const s = this.ships[i];
            if (!s || s.dead) continue;
            teamShips[s.owner] = (teamShips[s.owner] || 0) + 1;
            if (s.state === 'orbit' && s.targetPlanet) {
                orbiting.set(s.targetPlanet, (orbiting.get(s.targetPlanet) || 0) + 1);
            }
        }
        this.frameStats = { orbiting, teamShips };
    }

    update(deltaTime) {
        if (!this.isRunning) return;

        if (this.gameSpeed > 0) {
            this.gameTime += deltaTime; // real-time clock, unchanged

            const cfg = window.GAME_CONFIG;
            this.accumulator += Math.min(deltaTime, 0.25) * this.gameSpeed;

            let steps = 0;
            while (this.accumulator >= cfg.SIM_STEP && this.isRunning && steps < cfg.MAX_STEPS_PER_FRAME) {
                this.step(cfg.SIM_STEP);
                this.accumulator -= cfg.SIM_STEP;
                steps++;
            }
            if (steps >= cfg.MAX_STEPS_PER_FRAME) this.accumulator = 0;
        }

        if (this.renderer) this.renderer.render(this, this.controls);

    }

    step(dt) {
        if (this.telemetry) this.telemetry.updateTickMetrics(dt, this);

        this.planets.forEach(p => p.update(dt, this));
        this.ships.forEach(s => s.update(dt, this));

        if (this.aiController1) this.aiController1.update(dt);
        if (this.aiController2) this.aiController2.update(dt);

        for (const e of this.explosions) e.age += dt;
        this.explosions = this.explosions.filter(e => e.age < window.GAME_CONFIG.EXPLOSION_SECONDS);

        this.ships = this.ships.filter(s => s && !s.dead);
        this.refreshFrameStats();
        this.checkWinCondition();
    }

    checkWinCondition() {
        if (!this.isRunning) return;

        const team1Planets = this.planets.filter(p => p.owner === 1).length;
        const team1Ships = this.frameStats.teamShips[1] || 0;

        const team2Planets = this.planets.filter(p => p.owner === 2).length;
        const team2Ships = this.frameStats.teamShips[2] || 0;

        const team1Alive = team1Planets > 0 || team1Ships > 0;
        const team2Alive = team2Planets > 0 || team2Ships > 0;

        if (!team2Alive && team1Alive) {
            this.endGame(1);
        } else if (!team1Alive && team2Alive) {
            this.endGame(2);
        }
    }

    // The sim only records the result. Showing it on screen is the UI's job (onGameOver).
    endGame(winningTeam) {
        this.isRunning = false;
        this.winnerId = winningTeam;
        if (this.onGameOver) this.onGameOver(winningTeam);
    }
}

if (typeof window !== 'undefined') {
    window.GameManager = GameManager;
}