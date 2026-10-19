class App {
    constructor() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d');

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
        window.gameManager.onGameOver = (winningTeam) => this.showGameOver(winningTeam);
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
        const $ = (id) => document.getElementById(id);

        $('btn-title-enter').addEventListener('click', () => this.showMatchSetup());
        $('btn-setup-back').addEventListener('click', () => this.showTitleScreen());
        $('btn-setup-launch').addEventListener('click', () => this.launchSelectedMap());
        $('btn-new-match').addEventListener('click', () => {
            $('game-over-modal').classList.add('hidden');
            this.showMatchSetup();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === '`') this.hud.toggleDevPanel();
        });

        // UI sounds: hover plays when the mouse really moves onto a button, click plays on press.
        // A button that appears under a stationary mouse (new screen, popup) also fires mouseover,
        // so hover is skipped when the mouse position hasn't changed.
        this.lastMouseX = -1;
        this.lastMouseY = -1;
        document.addEventListener('mousemove', (e) => {
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });
        document.addEventListener('mouseover', (e) => {
            const btn = e.target.closest('button');
            if (!btn || btn.contains(e.relatedTarget)) return;
            if (e.clientX === this.lastMouseX && e.clientY === this.lastMouseY) return;
            AudioManager.play('ui_hover');
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('button')) AudioManager.play('ui_click');
        });

        // Arcade Faction Selector Arrows
        $('p1-prev').addEventListener('click', () => this.cycleFaction(1, -1));
        $('p1-next').addEventListener('click', () => this.cycleFaction(1, 1));
        $('p2-prev').addEventListener('click', () => this.cycleFaction(2, -1));
        $('p2-next').addEventListener('click', () => this.cycleFaction(2, 1));

        // Arcade Mode Toggle Button
        $('btn-toggle-gamemode').addEventListener('click', () => {
            this.gameMode = (this.gameMode === 'PLAYER_VS_CPU') ? 'CPU_VS_CPU' : 'PLAYER_VS_CPU';

            if (this.gameMode === 'CPU_VS_CPU') {
                $('btn-toggle-gamemode').textContent = 'SPECTATOR (CPU VS CPU)';
                $('p1-header-label').textContent = 'CPU 1 (TEAM 1)';
                $('p2-header-label').textContent = 'CPU 2 (TEAM 2)';
            } else {
                $('btn-toggle-gamemode').textContent = 'PLAYER VS CPU';
                $('p1-header-label').textContent = 'PLAYER 1';
                $('p2-header-label').textContent = 'CPU ENEMY';
            }
        });

        // In-Game ESC Exit Menu Bindings
        $('btn-esc-menu').addEventListener('click', () => this.openExitModal());
        $('btn-exit-yes').addEventListener('click', () => {
            this.closeExitModal();
            this.showMatchSetup();
        });
        $('btn-exit-no').addEventListener('click', () => {
            this.closeExitModal();
            window.gameManager.setSpeed(this.speedBeforeExit);
        });
    }

    cycleFaction(teamNum, direction) {
        const n = this.factionsList.length;

        if (teamNum === 1) {
            this.p1FactionIndex = (this.p1FactionIndex + direction + n) % n;
            if (this.p1FactionIndex === this.p2FactionIndex) {
                this.p1FactionIndex = (this.p1FactionIndex + direction + n) % n;
            }
        } else {
            this.p2FactionIndex = (this.p2FactionIndex + direction + n) % n;
            if (this.p2FactionIndex === this.p1FactionIndex) {
                this.p2FactionIndex = (this.p2FactionIndex + direction + n) % n;
            }
        }

        this.updateArcadeFactionDisplays();
        this.updateMenuFactionTheme();
    }

    updateArcadeFactionDisplays() {
        const f1 = FACTION_DATA[this.factionsList[this.p1FactionIndex]];
        const f2 = FACTION_DATA[this.factionsList[this.p2FactionIndex]];

        document.getElementById('p1-faction-display').textContent = f1.name.toUpperCase();
        document.getElementById('p2-faction-display').textContent = f2.name.toUpperCase();
    }

    updateMenuFactionTheme() {
        const f1 = FACTION_DATA[this.factionsList[this.p1FactionIndex]];
        const f2 = FACTION_DATA[this.factionsList[this.p2FactionIndex]];

        const teamHome = document.querySelector('.team-home');
        teamHome.style.borderLeftColor = f1.color;
        teamHome.querySelector('.team-header').style.color = f1.color;

        const teamAway = document.querySelector('.team-away');
        teamAway.style.borderRightColor = f2.color;
        teamAway.querySelector('.team-header').style.color = f2.color;
    }

    openExitModal() {
        const modal = document.getElementById('exit-confirm-modal');
        if (!modal.classList.contains('hidden')) return; // already open

        this.speedBeforeExit = window.gameManager.gameSpeed;
        window.gameManager.setSpeed(0); // Auto-pause

        document.getElementById('hud-top-center').inert = true; // lock the HUD
        modal.classList.remove('hidden');
        document.getElementById('btn-exit-no').focus();         // safe default for Enter/Space
    }

    // Game-over popup (the sim calls this through gameManager.onGameOver)
    showGameOver(winningTeam) {
        const gm = window.gameManager;
        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('game-over-title');
        const msg = document.getElementById('game-over-msg');

        const winner = FACTION_DATA[gm.factionMap[winningTeam]];
        const totalSecs = Math.floor(gm.gameTime);
        const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');

        if (gm.gameMode === 'CPU_VS_CPU') {
            title.textContent = `${winner.name.toUpperCase()} VICTORIOUS`;
            msg.textContent = `Automated spectator match ended in ${mins}:${secs}.`;
        } else {
            const isVictory = (winningTeam === 1);
            title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
            msg.textContent = isVictory
                ? `System secured in ${mins}:${secs}!`
                : `Fleet wiped out after ${mins}:${secs}.`;
        }
        title.style.color = winner.color;

        modal.classList.remove('hidden');
    }

    closeExitModal() {
        document.getElementById('exit-confirm-modal').classList.add('hidden');
        document.getElementById('hud-top-center').inert = false; // unlock the HUD
    }

    clearScreen() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Title screen: the opening "OPEN SPACE WARS / ENTER" screen
    showTitleScreen() {
        this.state = 'MENU';
        window.gameManager.stop();
        this.clearScreen();

        this.hud.hide();
        Viewport.update(this.canvas);
        document.getElementById('exit-confirm-modal').classList.add('hidden');

        document.getElementById('menu-title').style.display = 'block';
        document.getElementById('menu-match-setup').style.display = 'none';
    }

    // Match setup screen: pick factions, arena and mode
    showMatchSetup() {
        this.state = 'MATCH_SETUP';
        window.gameManager.stop();
        this.clearScreen();

        this.hud.hide();
        Viewport.update(this.canvas);

        document.getElementById('menu-title').style.display = 'none';
        document.getElementById('menu-match-setup').style.display = 'flex';

        this.updateArcadeFactionDisplays();
        this.updateMenuFactionTheme();
        this.renderMapSlots();
    }

    renderMapSlots() {
        const container = document.getElementById('slot-buttons');

        // Build the buttons once. Later calls only move the highlight.
        // (Rebuilding them under the mouse made the hover sound fire on every click.)
        if (container.children.length === 0) {
            this.registry.getAllMaps().forEach((map, idx) => {
                const slotNum = idx + 1;
                const btn = document.createElement('button');
                btn.className = 'slot-btn';
                btn.dataset.slot = slotNum;
                btn.innerText = `Map ${slotNum}: ${map.name}`;
                btn.onclick = () => {
                    this.selectedSlotNum = slotNum;
                    this.renderMapSlots();
                };
                container.appendChild(btn);
            });
        }

        for (const btn of container.children) {
            btn.classList.toggle('selected', Number(btn.dataset.slot) === this.selectedSlotNum);
        }
    }

    launchSelectedMap() {
        const cfg = window.GAME_CONFIG;
        const scaledMap = this.registry.getScaledMap(this.selectedSlotNum, cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);

        const playerFaction = this.factionsList[this.p1FactionIndex];
        const enemyFaction = this.factionsList[this.p2FactionIndex];

        this.state = 'GAME';
        this.clearScreen();
        document.getElementById('game-over-modal').classList.add('hidden');
        document.getElementById('menu-match-setup').style.display = 'none';

        this.hud.setFactions(FACTION_DATA[playerFaction], FACTION_DATA[enemyFaction]);
        this.hud.show();
        Viewport.update(this.canvas);

        window.gameManager.start(scaledMap, playerFaction, enemyFaction, this.gameMode);
    }

    loop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000 || 0;
        this.lastTime = timestamp;

        if (this.state === 'GAME') {
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