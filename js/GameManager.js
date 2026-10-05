class GameManager {
    constructor() {
        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        
        this.canvas = document.getElementById(dom.CANVAS_ID || 'game');
        this.planets = [];
        this.ships = [];
        this.currentMapData = null;

        // Subsystems initialized with defensive fallbacks
        this.renderer = typeof Renderer === 'function' ? new Renderer(this.canvas) : null;
        this.controls = typeof Controls === 'function' ? new Controls(this.canvas, this, 1) : null;
        this.aiController = typeof AIController === 'function' ? new AIController(this) : null;

        // Simulation State
        this.isRunning = false;
        this.gameTime = 0; 
        this.gameSpeed = (window.GAME_CONFIG && window.GAME_CONFIG.DEFAULT_SPEED) || 1; 

        // HUD Elements
        this.hudElement = document.getElementById(dom.HUD_ID || 'hud');
        this.hudTimer = document.getElementById(dom.TIMER_ID || 'game-timer');
        this.btnPlayPause = document.getElementById(dom.BTN_PLAY_PAUSE || 'btn-play-pause');
        this.btnSpeed1 = document.getElementById(dom.BTN_SPEED_1 || 'btn-speed-1');
        this.btnSpeed2 = document.getElementById(dom.BTN_SPEED_2 || 'btn-speed-2');
        this.btnSpeed3 = document.getElementById(dom.BTN_SPEED_3 || 'btn-speed-3');

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
        this.currentMapData = mapData;
        this.loadMap(mapData);
        this.isRunning = true;
        this.setSpeed((window.GAME_CONFIG && window.GAME_CONFIG.DEFAULT_SPEED) || 1);
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
        
        const modalId = (window.GAME_CONFIG && window.GAME_CONFIG.DOM && window.GAME_CONFIG.DOM.GAME_OVER_MODAL) || 'game-over-modal';
        document.getElementById(modalId)?.classList.add('hidden');
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

    spawnShip(sourcePlanet, targetPlanet) {
        if (!sourcePlanet || typeof Ship !== 'function') return null;
        const ship = new Ship(sourcePlanet, targetPlanet || sourcePlanet);
        this.ships.push(ship);
        return ship;
    }

    destroyShip(ship) {
        if (!ship) return;
        ship.dead = true;
        const idx = this.ships.indexOf(ship);
        if (idx !== -1) {
            this.ships.splice(idx, 1);
        }
    }

    dispatchFleet(sourcePlanet, targetPlanet, ratio) {
        if (!sourcePlanet || !targetPlanet || sourcePlanet === targetPlanet) return;
        
        const effectiveRatio = ratio !== undefined ? ratio : ((window.GAME_CONFIG && window.GAME_CONFIG.DEFAULT_FLEET_RATIO) || 0.5);

        const availableShips = this.ships.filter(s => 
            s && !s.dead && 
            s.owner === sourcePlanet.owner && 
            (s.targetPlanet === sourcePlanet || s.orbitPlanet === sourcePlanet) &&
            (s.state === 'orbit' || s.state === 'surface_launch')
        );

        if (availableShips.length === 0) return;

        const count = Math.max(1, Math.floor(availableShips.length * effectiveRatio));
        const fleet = availableShips.slice(0, count);

        fleet.forEach(ship => {
            ship.orbitPlanet = sourcePlanet;
            ship.targetPlanet = targetPlanet;
            ship.state = 'launching';
            ship.launchProgress = 0;
        });
    }

    update(deltaTime) {
        if (!this.isRunning) return;

        if (this.gameSpeed > 0) {
            this.gameTime += deltaTime;
            this.updateTimerDisplay();

            const scaledDelta = deltaTime * this.gameSpeed;

            this.planets.forEach(p => p && p.update && p.update(scaledDelta, this));
            this.ships.forEach(s => s && s.update && s.update(scaledDelta, this));

            if (this.aiController && this.aiController.update) {
                this.aiController.update(scaledDelta);
            }

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

    checkWinCondition() {
        if (!this.isRunning) return;

        const playerPlanets = this.planets.filter(p => p.owner === 1).length;
        const playerShips = this.ships.filter(s => s.owner === 1 && !s.dead).length;

        const aiPlanets = this.planets.filter(p => p.owner === 2).length;
        const aiShips = this.ships.filter(s => s.owner === 2 && !s.dead).length;

        const playerAlive = playerPlanets > 0 || playerShips > 0;
        const aiAlive = aiPlanets > 0 || aiShips > 0;

        if (!aiAlive && playerAlive) {
            this.endGame(true);
        } else if (!playerAlive) {
            this.endGame(false);
        }
    }

    endGame(isVictory) {
        this.isRunning = false;

        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        const modal = document.getElementById(dom.GAME_OVER_MODAL || 'game-over-modal');
        const title = document.getElementById(dom.GAME_OVER_TITLE || 'game-over-title');
        const msg = document.getElementById(dom.GAME_OVER_MSG || 'game-over-msg');

        if (modal && title && msg) {
            title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
            title.style.color = isVictory ? '#00ffcc' : '#ff3355';

            const totalSecs = Math.floor(this.gameTime);
            const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
            const secs = String(totalSecs % 60).padStart(2, '0');

            msg.textContent = isVictory 
                ? `System secured in ${mins}:${secs}!` 
                : `Fleet wiped out after ${mins}:${secs}.`;

            modal.classList.remove('hidden');
        }
    }
}