class App {
    constructor() {
        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        this.canvas = document.getElementById(dom.CANVAS_ID || 'game');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.state = 'MENU';
        this.selectedSlotNum = 1;
        this.lastTime = performance.now();
        this.speedBeforeExit = 1;

        this.factionsList = [];
        this.p1FactionIndex = 0;
        this.p2FactionIndex = 1;
        this.gameMode = 'PLAYER_VS_CPU';

        this.registry = new MapRegistry();

        this.hud = new HUD(window.gameManager);
        this.initFactions();
        this.bindEvents();
        this.showTitleScreen();
        this.loop(performance.now());
    }

    initFactions() {
        this.factionsList = Object.keys(FACTION_DATA);
        this.p1FactionIndex = this.factionsList.indexOf('REMNANTS');
        this.p2FactionIndex = this.factionsList.indexOf('PROTOCOL');
    }

    bindEvents() {
        document.getElementById('btn-title-enter')?.addEventListener('click', () => this.showMatchSetup());
        document.getElementById('btn-setup-back')?.addEventListener('click', () => this.showTitleScreen());
        document.getElementById('btn-setup-launch')?.addEventListener('click', () => this.launchSelectedMap());
        document.getElementById('btn-new-match')?.addEventListener('click', () => {
            document.getElementById('game-over-modal')?.classList.add('hidden');
            this.showMatchSetup();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === '`') this.hud.toggleDevPanel();
        });

        // Hover sound on any button (plays once when the mouse enters it)
        document.addEventListener('mouseover', (e) => {
            const btn = e.target.closest('button');
            if (btn && !btn.contains(e.relatedTarget)) AudioManager.play('ui_hover');
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
            this.showTitleScreen();
        });
        document.getElementById('btn-exit-no')?.addEventListener('click', () => {
            this.closeExitModal();
            if (window.gameManager) window.gameManager.setSpeed(this.speedBeforeExit ?? 1); // Resume previous speed
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
        const f1 = FACTION_DATA[this.factionsList[this.p1FactionIndex]];
        const f2 = FACTION_DATA[this.factionsList[this.p2FactionIndex]];

        const p1Display = document.getElementById('p1-faction-display');
        const p2Display = document.getElementById('p2-faction-display');

        if (p1Display) p1Display.textContent = f1.name.toUpperCase();
        if (p2Display) p2Display.textContent = f2.name.toUpperCase();
    }

    updateMenuFactionTheme() {
        const f1 = FACTION_DATA[this.factionsList[this.p1FactionIndex]];
        const f2 = FACTION_DATA[this.factionsList[this.p2FactionIndex]];

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
        const modal = document.getElementById('exit-confirm-modal');
        if (!modal || !modal.classList.contains('hidden')) return; // already open

        if (window.gameManager) {
            this.speedBeforeExit = window.gameManager.gameSpeed;
            window.gameManager.setSpeed(0); // Auto-pause
        }
        modal.classList.remove('hidden');
    }

    closeExitModal() {
        document.getElementById('exit-confirm-modal')?.classList.add('hidden');
    }

    clearScreen() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // Title screen: the opening "OPEN SPACE WARS / ENTER" screen
    showTitleScreen() {
        this.state = 'MENU';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();

        this.hud.hide();
        Viewport.update(this.canvas);
        document.getElementById('exit-confirm-modal')?.classList.add('hidden');

        const menuTitle = document.getElementById('menu-title');
        const menuSetup = document.getElementById('menu-match-setup');

        if (menuTitle) menuTitle.style.display = 'block';
        if (menuSetup) menuSetup.style.display = 'none';
    }

    // Match setup screen: pick factions, arena and mode
    showMatchSetup() {
        this.state = 'MATCH_SETUP';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();

        this.hud.hide();
        Viewport.update(this.canvas);

        const menuTitle = document.getElementById('menu-title');
        const menuSetup = document.getElementById('menu-match-setup');

        if (menuTitle) menuTitle.style.display = 'none';
        if (menuSetup) menuSetup.style.display = 'flex';

        this.updateArcadeFactionDisplays();
        this.updateMenuFactionTheme();
        this.renderMapSlots();
    }

    renderMapSlots() {
        const container = document.getElementById('slot-buttons');
        if (!container) return;

        container.innerHTML = '';

        this.registry.getAllMaps().forEach((map, idx) => {
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
        const cfg = window.GAME_CONFIG;
        const scaledMap = this.registry.getScaledMap(this.selectedSlotNum, cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);

        const playerFaction = this.factionsList[this.p1FactionIndex];
        const enemyFaction = this.factionsList[this.p2FactionIndex];

        this.state = 'GAME';
        this.clearScreen();

        const menuSetup = document.getElementById('menu-match-setup');
        if (menuSetup) menuSetup.style.display = 'none';

        const f1 = FACTION_DATA[playerFaction];
        const f2 = FACTION_DATA[enemyFaction];

        this.hud.setFactions(f1, f2);
        this.hud.show();
        Viewport.update(this.canvas);

        if (window.gameManager) {
            window.gameManager.start(scaledMap, playerFaction, enemyFaction, this.gameMode);
        }
    }

    loop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000 || 0;
        this.lastTime = timestamp;

        if (this.state === 'GAME' && window.gameManager) {
            window.gameManager.update(deltaTime);
            this.hud.update();
        }

        requestAnimationFrame((ts) => this.loop(ts));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
} else {
    window.app = new App();
}