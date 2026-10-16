class App {
    constructor() {
        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        this.canvas = document.getElementById(dom.CANVAS_ID || 'game');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        this.state = 'MENU';
        this.selectedSlotNum = 1;
        this.lastTime = performance.now();

        this.factionsList = [];
        this.p1FactionIndex = 0;
        this.p2FactionIndex = 1;
        this.gameMode = 'PLAYER_VS_CPU';

        this.registry = typeof MapRegistry === 'function' ? new MapRegistry() : null;

        this.initFactions();
        this.bindEvents();
        this.showMainMenu();
        this.loop(performance.now());
    }

    initFactions() {
        if (typeof FACTION_DATA !== 'undefined') {
            this.factionsList = Object.keys(FACTION_DATA);
        } else {
            this.factionsList = ['REMNANTS', 'PROTOCOL'];
        }
        // Ensure defaults don't match if possible
        this.p1FactionIndex = this.factionsList.indexOf('REMNANTS') !== -1 ? this.factionsList.indexOf('REMNANTS') : 0;
        this.p2FactionIndex = this.factionsList.indexOf('PROTOCOL') !== -1 ? this.factionsList.indexOf('PROTOCOL') : Math.min(1, this.factionsList.length - 1);
    }

    bindEvents() {
        document.getElementById('btn-main-play')?.addEventListener('click', () => this.showMapSelect());
        document.getElementById('btn-map-back')?.addEventListener('click', () => this.showMainMenu());
        document.getElementById('btn-map-start')?.addEventListener('click', () => this.launchSelectedMap());
        document.getElementById('btn-restart')?.addEventListener('click', () => {
        document.getElementById('game-over-modal')?.classList.add('hidden');
        this.showMapSelect();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === '`') document.getElementById('dev-panel')?.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('button')) AudioManager.play('ui_hover');
        });

        // Arcade Faction Selector Arrows
        document.getElementById('p1-prev')?.addEventListener('click', () => this.cycleFaction(1, -1));
        document.getElementById('p1-next')?.addEventListener('click', () => this.cycleFaction(1, 1));
        document.getElementById('p2-prev')?.addEventListener('click', () => this.cycleFaction(2, -1));
        document.getElementById('p2-next')?.addEventListener('click', () => this.cycleFaction(2, 1));

        // Arcade Mode Toggle Button
        document.getElementById('btn-toggle-gamemode')?.addEventListener('click', () => {
            this.gameMode = (this.gameMode === 'PLAYER_VS_CPU') ? 'CPU_VS_CPU' : 'PLAYER_VS_CPU';
            const btn = document.getElementById('btn-toggle-gamemode');
            const p1Label = document.getElementById('p1-header-label');
            const p2Label = document.getElementById('p2-header-label');

            if (this.gameMode === 'CPU_VS_CPU') {
                if (btn) btn.textContent = 'SPECTATOR (CPU VS CPU)';
                if (p1Label) p1Label.textContent = 'CPU 1 (TEAM 1)';
                if (p2Label) p2Label.textContent = 'CPU 2 (TEAM 2)';
            } else {
                if (btn) btn.textContent = 'PLAYER VS CPU';
                if (p1Label) p1Label.textContent = 'PLAYER 1';
                if (p2Label) p2Label.textContent = 'CPU ENEMY';
            }
        });

        // In-Game ESC Exit Menu Bindings
        document.getElementById('btn-esc-menu')?.addEventListener('click', () => this.openExitModal());
        document.getElementById('btn-exit-yes')?.addEventListener('click', () => {
            this.closeExitModal();
            this.showMainMenu();
        });
        document.getElementById('btn-exit-no')?.addEventListener('click', () => {
            this.closeExitModal();
            if (window.gameManager) window.gameManager.setSpeed(1); // Resume game speed
        });
    }

    cycleFaction(teamNum, direction) {
        if (this.factionsList.length === 0) return;

        if (teamNum === 1) {
            this.p1FactionIndex = (this.p1FactionIndex + direction + this.factionsList.length) % this.factionsList.length;
            if (this.p1FactionIndex === this.p2FactionIndex) {
                this.p1FactionIndex = (this.p1FactionIndex + direction + this.factionsList.length) % this.factionsList.length;
            }
        } else {
            this.p2FactionIndex = (this.p2FactionIndex + direction + this.factionsList.length) % this.factionsList.length;
            if (this.p2FactionIndex === this.p1FactionIndex) {
                this.p2FactionIndex = (this.p2FactionIndex + direction + this.factionsList.length) % this.factionsList.length;
            }
        }

        this.updateArcadeFactionDisplays();
        this.updateMenuFactionTheme();
    }

    updateArcadeFactionDisplays() {
        const p1Key = this.factionsList[this.p1FactionIndex] || 'REMNANTS';
        const p2Key = this.factionsList[this.p2FactionIndex] || 'PROTOCOL';

        const p1Display = document.getElementById('p1-faction-display');
        const p2Display = document.getElementById('p2-faction-display');

        if (p1Display && typeof FACTION_DATA !== 'undefined' && FACTION_DATA[p1Key]) {
            p1Display.textContent = FACTION_DATA[p1Key].name.toUpperCase();
        }
        if (p2Display && typeof FACTION_DATA !== 'undefined' && FACTION_DATA[p2Key]) {
            p2Display.textContent = FACTION_DATA[p2Key].name.toUpperCase();
        }
    }

    updateMenuFactionTheme() {
        if (typeof FACTION_DATA === 'undefined') return;

        const p1Key = this.factionsList[this.p1FactionIndex] || 'REMNANTS';
        const p2Key = this.factionsList[this.p2FactionIndex] || 'PROTOCOL';

        const f1 = FACTION_DATA[p1Key] || FACTION_DATA.REMNANTS;
        const f2 = FACTION_DATA[p2Key] || FACTION_DATA.PROTOCOL;

        const teamHome = document.querySelector('.team-home');
        if (teamHome) {
            teamHome.style.borderLeftColor = f1.color;
            const header = teamHome.querySelector('.team-header');
            if (header) header.style.color = f1.color;
        }

        const teamAway = document.querySelector('.team-away');
        if (teamAway) {
            teamAway.style.borderRightColor = f2.color;
            const header = teamAway.querySelector('.team-header');
            if (header) header.style.color = f2.color;
        }
    }

    openExitModal() {
        if (window.gameManager) window.gameManager.setSpeed(0); // Auto-pause
        document.getElementById('exit-confirm-modal')?.classList.remove('hidden');
    }

    closeExitModal() {
        document.getElementById('exit-confirm-modal')?.classList.add('hidden');
    }

    clearScreen() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    showMainMenu() {
        this.state = 'MENU';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();

        document.getElementById('hud-top-center')?.classList.add('hidden');
        Viewport.update(this.canvas);
        document.getElementById('exit-confirm-modal')?.classList.add('hidden');

        const menuMain = document.getElementById('menu-main');
        const menuMap = document.getElementById('menu-map-select');

        if (menuMain) menuMain.style.display = 'block';
        if (menuMap) menuMap.style.display = 'none';
    }

    showMapSelect() {
        this.state = 'MAP_SELECT';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();

        document.getElementById('hud-top-center')?.classList.add('hidden');
        Viewport.update(this.canvas);

        const menuMain = document.getElementById('menu-main');
        const menuMap = document.getElementById('menu-map-select');

        if (menuMain) menuMain.style.display = 'none';
        if (menuMap) menuMap.style.display = 'flex';

        this.updateArcadeFactionDisplays();
        this.updateMenuFactionTheme();
        this.renderMapSlots();
    }

    renderMapSlots() {
        const container = document.getElementById('slot-buttons');
        if (!container || !this.registry) return;

        container.innerHTML = '';
        const allMaps = this.registry.getAllMaps ? this.registry.getAllMaps() : [];

        allMaps.forEach((map, idx) => {
            const slotNum = idx + 1;
            const btn = document.createElement('button');
            btn.className = `slot-btn ${slotNum === this.selectedSlotNum ? 'selected' : ''}`;
            btn.innerText = `Map ${slotNum}: ${map.name}`;
            btn.onclick = () => {
                this.selectedSlotNum = slotNum;
                this.renderMapSlots();
            };
            container.appendChild(btn);
        });
    }

    launchSelectedMap() {
        if (!this.registry) return;

        const cfg = window.GAME_CONFIG;
        const scaledMap = this.registry.getScaledMap(this.selectedSlotNum, cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);

        const playerFaction = this.factionsList[this.p1FactionIndex] || 'REMNANTS';
        const enemyFaction = this.factionsList[this.p2FactionIndex] || 'PROTOCOL';

        this.state = 'GAME';
        this.clearScreen();
        
        const menuMap = document.getElementById('menu-map-select');
        if (menuMap) menuMap.style.display = 'none';

        const f1 = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[playerFaction]) ? FACTION_DATA[playerFaction] : { name: playerFaction, color: '#00aaff' }; // make these match the faction colours at some point
        const f2 = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[enemyFaction]) ? FACTION_DATA[enemyFaction] : { name: enemyFaction, color: '#ff3355' }; // make these match the faction colours at some point

        const cardT1 = document.getElementById('hud-card-t1');
        const cardT2 = document.getElementById('hud-card-t2');
        const labelT1 = document.getElementById('hud-label-t1');
        const labelT2 = document.getElementById('hud-label-t2');
        const valT1 = document.getElementById('hud-val-t1');
        const valT2 = document.getElementById('hud-val-t2');

        if (cardT1) cardT1.style.borderLeftColor = f1.color;
        if (cardT2) cardT2.style.borderRightColor = f2.color;
        if (labelT1) {
            labelT1.textContent = f1.name.toUpperCase();
            labelT1.style.color = f1.color;
        }
        if (labelT2) {
            labelT2.textContent = f2.name.toUpperCase();
            labelT2.style.color = f2.color;
        }
        if (valT1) valT1.style.color = f1.color;
        if (valT2) valT2.style.color = f2.color;

        document.getElementById('hud-top-center')?.classList.remove('hidden');
        Viewport.update(this.canvas);

        if (window.gameManager) {
            window.gameManager.start(scaledMap, playerFaction, enemyFaction, this.gameMode);
        }
    }

    updateInGameHUD() {
        if (!window.gameManager || !window.gameManager.ships) return;

        const gm = window.gameManager;
        const t1Count = gm.frameStats.teamShips[1] || 0;
        const t2Count = gm.frameStats.teamShips[2] || 0;

        const valT1 = document.getElementById('hud-val-t1');
        const valT2 = document.getElementById('hud-val-t2');

        if (valT1) valT1.textContent = t1Count;
        if (valT2) valT2.textContent = t2Count;

        const durationMins = Math.max(0.05, gm.gameTime / 60);
        const t1Spawned = gm.telemetry ? gm.telemetry.summary.team1.shipsSpawned : 0;
        const t2Spawned = gm.telemetry ? gm.telemetry.summary.team2.shipsSpawned : 0;

        const spmT1 = document.getElementById('hud-spm-t1');
        const spmT2 = document.getElementById('hud-spm-t2');

        if (spmT1) spmT1.textContent = (t1Spawned / durationMins).toFixed(1);
        if (spmT2) spmT2.textContent = (t2Spawned / durationMins).toFixed(1);

        const stateT1 = document.getElementById('hud-state-t1');
        const stateT2 = document.getElementById('hud-state-t2');

        if (stateT1) {
            const stStr = gm.aiController1 ? gm.aiController1.currentState : 'HUMAN_PLAYER';
            stateT1.textContent = `STATE: ${stStr}`;
        }
        if (stateT2) {
            const stStr = gm.aiController2 ? gm.aiController2.currentState : 'HUMAN_PLAYER';
            stateT2.textContent = `STATE: ${stStr}`;
        }
        
        this.updateDevPanel(gm);
    }

    updateDevPanel(gm) {
        const panel = document.getElementById('dev-panel');
        if (!panel || panel.classList.contains('hidden') || !gm.telemetry) return;

        const fill = (id, teamId, ai) => {
            const el = document.getElementById(id);
            if (!el) return;
            const t = gm.telemetry.summary['team' + teamId];
            const planets = gm.planets.filter(p => p.owner === teamId).length;
            el.innerHTML =
                `<div>AI: ${ai ? ai.currentState : 'HUMAN_PLAYER'}</div>` +
                `<div>PLANETS: ${planets}</div>` +
                `<div>SPAWNED: ${t.shipsSpawned}</div>` +
                `<div>KILLS: ${t.shipsKilled}  LOST: ${t.shipsLost}</div>` +
                `<div>DMG OUT: ${Math.round(t.damageDealt)}  IN: ${Math.round(t.damageReceived)}</div>` +
                `<div>CAPTURES: ${t.planetsCaptured}  UPGRADES: ${t.upgrades}</div>`;
        };

        fill('dev-t1', 1, gm.aiController1);
        fill('dev-t2', 2, gm.aiController2);
    }

    loop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000 || 0;
        this.lastTime = timestamp;

        if (this.state === 'GAME' && window.gameManager) {
            window.gameManager.update(deltaTime);
            this.updateInGameHUD();
        } else if (this.state === 'MENU' || this.state === 'MAP_SELECT') {
            this.clearScreen();
        }

        requestAnimationFrame((ts) => this.loop(ts));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
} else {
    window.app = new App();
}