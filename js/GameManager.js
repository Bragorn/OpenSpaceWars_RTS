class GameManager {
    constructor() {
        this.canvas = document.getElementById('game');
        this.planets = [];
        this.ships = [];

        this.renderer = typeof Renderer === 'function' ? new Renderer(this.canvas) : null;
        this.controls = typeof Controls === 'function' ? new Controls(this.canvas, this, 1) : null;
        this.aiController = typeof AIController === 'function' ? new AIController(this) : null;

        // Simulation State
        this.isRunning = false;
        this.gameTime = 0; 
        this.gameSpeed = 1; 

        // HUD Elements
        this.hudElement = document.getElementById('hud');
        this.hudTimer = document.getElementById('game-timer');
        this.btnPlayPause = document.getElementById('btn-play-pause');
        this.btnSpeed1 = document.getElementById('btn-speed-1');
        this.btnSpeed2 = document.getElementById('btn-speed-2');
        this.btnSpeed3 = document.getElementById('btn-speed-3');

        this.initHUDListeners();
    }

    initHUDListeners() {
        this.btnPlayPause?.addEventListener('click', () => {
            this.setSpeed(this.gameSpeed === 0 ? 1 : 0);
        });

        this.btnSpeed1?.addEventListener('click', () => this.setSpeed(1));
        this.btnSpeed2?.addEventListener('click', () => this.setSpeed(2));
        this.btnSpeed3?.addEventListener('click', () => this.setSpeed(3));
    }

    setSpeed(speed) {
        this.gameSpeed = speed;
        this.updateHUDUI();
    }

    updateHUDUI() {
        const isPaused = (this.gameSpeed === 0);

        if (this.btnPlayPause) {
            this.btnPlayPause.textContent = isPaused ? 'Play' : 'Pause';
            this.btnPlayPause.classList.toggle('active', isPaused);
        }

        this.btnSpeed1?.classList.toggle('active', !isPaused && this.gameSpeed === 1);
        this.btnSpeed2?.classList.toggle('active', !isPaused && this.gameSpeed === 2);
        this.btnSpeed3?.classList.toggle('active', !isPaused && this.gameSpeed === 3);
    }

    start(mapData) {
        this.reset();
        this.loadMap(mapData);
        this.isRunning = true;
        this.setSpeed(1);
        this.hudElement?.classList.remove('hidden');
    }

    stop() {
        this.isRunning = false;
        this.hudElement?.classList.add('hidden');
    }

    reset() {
        this.planets = [];
        this.ships = [];
        this.gameTime = 0;
        this.updateTimerDisplay();
    }

    // Called directly by Planet.js to produce new ships
    spawnShip(sourcePlanet, targetPlanet) {
        if (!sourcePlanet || typeof Ship !== 'function') return null;
        const ship = new Ship(sourcePlanet, targetPlanet || sourcePlanet);
        this.ships.push(ship);
        return ship;
    }

    // Called directly by Ship.js / Planet.js when a ship dies
    destroyShip(ship) {
        if (!ship) return;
        ship.dead = true;
        const idx = this.ships.indexOf(ship);
        if (idx !== -1) {
            this.ships.splice(idx, 1);
        }
    }

    update(deltaTime) {
        if (!this.isRunning) return;

        if (this.gameSpeed > 0) {
            const scaledDelta = deltaTime * this.gameSpeed;

            this.gameTime += scaledDelta;
            this.updateTimerDisplay();

            // Pass 'this' (gameManager) so planets and ships can access spawnShip and destroyShip
            this.planets.forEach(p => p && p.update && p.update(scaledDelta, this));
            this.ships.forEach(s => s && s.update && s.update(scaledDelta, this));

            if (this.aiController && this.aiController.update) {
                this.aiController.update(scaledDelta);
            }

            // Clean up dead ships using Ship.js 'dead' flag
            this.ships = this.ships.filter(s => s && !s.dead);
            this.checkWinCondition();
        }

        if (this.renderer && this.renderer.render) {
            this.renderer.render(this, this.controls);
        }
    }

    updateTimerDisplay() {
        if (!this.hudTimer) return;
        const totalSecs = Math.floor(this.gameTime);
        const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        this.hudTimer.textContent = `${mins}:${secs}`;
    }

    loadMap(mapData) {
        this.planets = [];
        this.ships = [];

        if (!mapData) return;

        let parsed = mapData;
        if (typeof mapData === 'string') {
            try {
            parsed = JSON.parse(mapData);
            } catch (e) {
                console.error("GameManager: Failed to parse map JSON", e);
                return;
            }
        }

        const rawPlanets = parsed.planets || (Array.isArray(parsed) ? parsed : []);

        this.planets = rawPlanets.map(p => {
            if (p instanceof Planet) return p;
            return new Planet(p.x, p.y, p.level || 1, p.owner !== undefined ? p.owner : 0);
        });
    }

    dispatchFleet(sourcePlanet, targetPlanet, ratio = 0.5) {
        if (!sourcePlanet || !targetPlanet || sourcePlanet === targetPlanet) return;

        // Find available orbiting ships at sourcePlanet owned by sourcePlanet.owner
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

    checkWinCondition() {
        // Win / loss condition checks
    }
}