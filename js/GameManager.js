class GameManager {
    constructor(isHeadless = false) {
        this.isHeadless = isHeadless;
        const dom = (!this.isHeadless && window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        
        this.canvas = !this.isHeadless ? document.getElementById(dom.CANVAS_ID || 'game') : null;
        this.planets = [];
        this.ships = [];
        this.currentMapData = null;

        // Mode: 'PLAYER_VS_CPU' | 'CPU_VS_CPU'
        this.gameMode = 'PLAYER_VS_CPU';

        // Faction Mapping per team owner ID (1 = Team 1, 2 = Team 2)
        this.factionMap = {
            0: 'NEUTRAL',
            1: 'HUMAN',
            2: 'PROTOCOL'
        };

        // Subsystems (Skip in Headless Mode)
        this.renderer = (!this.isHeadless && typeof Renderer === 'function' && this.canvas) ? new Renderer(this.canvas) : null;
        this.controls = null;
        this.aiController1 = null;
        this.aiController2 = null;

        // Simulation State
        this.isRunning = false;
        this.gameTime = 0; 
        this.gameSpeed = (window.GAME_CONFIG && window.GAME_CONFIG.DEFAULT_SPEED) || 1; 

        // HUD Elements (Skip DOM queries in Headless Mode)
        if (!this.isHeadless) {
            this.hudElement = document.getElementById(dom.HUD_ID || 'hud');
            this.hudTimer = document.getElementById(dom.TIMER_ID || 'game-timer');
            this.btnPlayPause = document.getElementById(dom.BTN_PLAY_PAUSE || 'btn-play-pause');
            this.btnSpeed1 = document.getElementById(dom.BTN_SPEED_1 || 'btn-speed-1');
            this.btnSpeed2 = document.getElementById(dom.BTN_SPEED_2 || 'btn-speed-2');
            this.btnSpeed3 = document.getElementById(dom.BTN_SPEED_3 || 'btn-speed-3');
            this.initHUDListeners();
        }
    }

    setFactionMap(team1FactionKey, team2FactionKey) {
        this.factionMap = {
            0: 'NEUTRAL',
            1: team1FactionKey || 'HUMAN',
            2: team2FactionKey || 'PROTOCOL'
        };
    }

    initHUDListeners() {
        if (this.isHeadless) return;

        this.btnPlayPause?.addEventListener('click', () => {
            this.setSpeed(this.gameSpeed === 0 ? 1 : 0);
        });

        this.btnSpeed1?.addEventListener('click', () => this.setSpeed(1));
        this.btnSpeed2?.addEventListener('click', () => this.setSpeed(2));
        this.btnSpeed3?.addEventListener('click', () => this.setSpeed(3));
    }

    setSpeed(speed) {
        this.gameSpeed = speed;
        if (!this.isHeadless) this.updateHUDUI();
    }

    updateHUDUI() {
        if (this.isHeadless) return;
        const isPaused = (this.gameSpeed === 0);

        if (this.btnPlayPause) {
            this.btnPlayPause.textContent = isPaused ? 'Play' : 'Pause';
            this.btnPlayPause.classList.toggle('active', isPaused);
        }

        this.btnSpeed1?.classList.toggle('active', !isPaused && this.gameSpeed === 1);
        this.btnSpeed2?.classList.toggle('active', !isPaused && this.gameSpeed === 2);
        this.btnSpeed3?.classList.toggle('active', !isPaused && this.gameSpeed === 3);
    }

    start(mapData, team1FactionKey, team2FactionKey, gameMode = 'PLAYER_VS_CPU') {
        this.reset();
        this.gameMode = gameMode;
        this.setFactionMap(team1FactionKey, team2FactionKey);

        // Configure Controllers based on Mode
        if (this.gameMode === 'CPU_VS_CPU') {
            this.controls = null;
            this.aiController1 = typeof AIController === 'function' ? new AIController(this, 1) : null;
            this.aiController2 = typeof AIController === 'function' ? new AIController(this, 2) : null;
        } else {
            this.controls = (!this.isHeadless && typeof Controls === 'function' && this.canvas) ? new Controls(this.canvas, this, 1) : null;
            this.aiController1 = null;
            this.aiController2 = typeof AIController === 'function' ? new AIController(this, 2) : null;
        }

        this.currentMapData = mapData;
        this.loadMap(mapData);
        this.isRunning = true;
        this.setSpeed((window.GAME_CONFIG && window.GAME_CONFIG.DEFAULT_SPEED) || 1);
        
        if (!this.isHeadless) {
            this.hudElement?.classList.remove('hidden');
        }
    }

    stop() {
        this.isRunning = false;
        if (!this.isHeadless) {
            this.hudElement?.classList.add('hidden');
        }
    }

    reset() {
        this.planets = [];
        this.ships = [];
        this.gameTime = 0;
        
        if (!this.isHeadless) {
            this.updateTimerDisplay();
            const modalId = (window.GAME_CONFIG && window.GAME_CONFIG.DOM && window.GAME_CONFIG.DOM.GAME_OVER_MODAL) || 'game-over-modal';
            document.getElementById(modalId)?.classList.add('hidden');
        }
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
            if (typeof Planet === 'function') {
                return new Planet(p.x, p.y, p.level || 1, p.owner !== undefined ? p.owner : 0);
            }
            return p;
        });
    }

    spawnShip(sourcePlanet, targetPlanet) {
        if (!sourcePlanet || typeof Ship !== 'function') return null;
        const ship = new Ship(sourcePlanet, targetPlanet || sourcePlanet, this);
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
            
            if (!this.isHeadless) {
                this.updateTimerDisplay();
            }

            const scaledDelta = deltaTime * this.gameSpeed;

            this.planets.forEach(p => p && p.update && p.update(scaledDelta, this));
            this.ships.forEach(s => s && s.update && s.update(scaledDelta, this));

            // Execute active AI controllers
            if (this.aiController1 && this.aiController1.update) {
                this.aiController1.update(scaledDelta);
            }
            if (this.aiController2 && this.aiController2.update) {
                this.aiController2.update(scaledDelta);
            }

            this.ships = this.ships.filter(s => s && !s.dead);
            this.checkWinCondition();
        }

        // Only draw graphics if NOT headless
        if (!this.isHeadless && this.renderer && this.renderer.render) {
            this.renderer.render(this, this.controls);
        }
    }

    updateTimerDisplay() {
        if (this.isHeadless || !this.hudTimer) return;
        const totalSecs = Math.floor(this.gameTime);
        const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        this.hudTimer.textContent = `${mins}:${secs}`;
    }

    checkWinCondition() {
        if (!this.isRunning) return;

        const team1Planets = this.planets.filter(p => p.owner === 1).length;
        const team1Ships = this.ships.filter(s => s.owner === 1 && !s.dead).length;

        const team2Planets = this.planets.filter(p => p.owner === 2).length;
        const team2Ships = this.ships.filter(s => s.owner === 2 && !s.dead).length;

        const team1Alive = team1Planets > 0 || team1Ships > 0;
        const team2Alive = team2Planets > 0 || team2Ships > 0;

        if (!team2Alive && team1Alive) {
            this.endGame(1);
        } else if (!team1Alive && team2Alive) {
            this.endGame(2);
        }
    }

    endGame(winningTeam) {
        this.isRunning = false;
        this.winnerId = winningTeam;

        if (this.isHeadless) return; // Skip UI modal popup in headless simulation

        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        const modal = document.getElementById(dom.GAME_OVER_MODAL || 'game-over-modal');
        const title = document.getElementById(dom.GAME_OVER_TITLE || 'game-over-title');
        const msg = document.getElementById(dom.GAME_OVER_MSG || 'game-over-msg');

        if (modal && title && msg) {
            const fac1Name = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[this.factionMap[1]]) ? FACTION_DATA[this.factionMap[1]].name : 'Team 1';
            const fac2Name = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[this.factionMap[2]]) ? FACTION_DATA[this.factionMap[2]].name : 'Team 2';

            const totalSecs = Math.floor(this.gameTime);
            const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
            const secs = String(totalSecs % 60).padStart(2, '0');

            if (this.gameMode === 'CPU_VS_CPU') {
                const winnerName = winningTeam === 1 ? fac1Name : fac2Name;
                title.textContent = `${winnerName.toUpperCase()} VICTORIOUS`;
                title.style.color = winningTeam === 1 ? '#00aaff' : '#ff3355';
                msg.textContent = `Automated spectator match ended in ${mins}:${secs}.`;
            } else {
                const isVictory = (winningTeam === 1);
                title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
                title.style.color = isVictory ? '#00ffcc' : '#ff3355';
                msg.textContent = isVictory 
                    ? `System secured in ${mins}:${secs}!` 
                    : `Fleet wiped out after ${mins}:${secs}.`;
            }

            modal.classList.remove('hidden');
        }
    }
}