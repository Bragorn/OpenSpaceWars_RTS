// In-game HUD: top bar, ship counts, timer, speed buttons and the backtick dev panel.
// It reads game state and shows it. It never changes the game, except through the speed buttons.
class HUD {
    constructor(gameManager) {
        this.gm = gameManager;
        this.lastSpeed = null;
        this.deadShown = { 1: 0, 2: 0 };
        this.lastTick = null;

        const $ = (id) => document.getElementById(id);
        this.el = {
            bar: $('hud-top-center'),
            timer: $('game-timer'),
            playPause: $('btn-play-pause'),
            speed1: $('btn-speed-1'),
            speed2: $('btn-speed-2'),
            speed3: $('btn-speed-3'),
            cardT1: $('hud-card-t1'),
            cardT2: $('hud-card-t2'),
            labelT1: $('hud-label-t1'),
            labelT2: $('hud-label-t2'),
            valT1: $('hud-val-t1'),
            valT2: $('hud-val-t2'),
            spmT1: $('hud-spm-t1'),
            spmT2: $('hud-spm-t2'),
            send: $('hud-send'),
            deadT1: $('hud-dead-t1'),
            deadT2: $('hud-dead-t2'),
            devPanel: $('dev-panel'),
            devT1: $('dev-t1'),
            devT2: $('dev-t2')
        };

        this.bindButtons();
    }

    bindButtons() {
        const gm = this.gm;
        const el = this.el;
        el.playPause.onclick = () => gm.setSpeed(gm.gameSpeed === 0 ? 1 : 0);
        el.speed1.onclick = () => gm.setSpeed(1);
        el.speed2.onclick = () => gm.setSpeed(2);
        el.speed3.onclick = () => gm.setSpeed(3);
    }

    // Only touch the page when the text actually changed
    setText(el, text) {
        if (el.textContent !== text) el.textContent = text;
    }

    show() {
        this.lastSpeed = null; // force the speed buttons to refresh
        this.deadShown = { 1: 0, 2: 0 };
        this.lastTick = null;
        this.el.bar.classList.remove('hidden');
    }

    hide() {
        this.el.bar.classList.add('hidden');
    }

    toggleDevPanel() {
        this.el.devPanel.classList.toggle('hidden');
    }

    // Team names and colors for the top bar (f1, f2 are entries from FACTION_DATA)
    setFactions(f1, f2) {
        const el = this.el;
        el.cardT1.style.borderLeftColor = f1.color;
        el.cardT2.style.borderRightColor = f2.color;
        el.labelT1.textContent = f1.name.toUpperCase();
        el.labelT1.style.color = f1.color;
        el.labelT2.textContent = f2.name.toUpperCase();
        el.labelT2.style.color = f2.color;
        el.valT1.style.color = f1.color;
        el.valT2.style.color = f2.color;
    }

    // Called every frame while a match is running
    update() {
        const gm = this.gm;
        const el = this.el;

        // Timer (real time, not scaled by game speed)
        const totalSecs = Math.floor(gm.gameTime);
        const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        this.setText(el.timer, `${mins}:${secs}`);

        // Speed buttons (only when the speed changes)
        if (gm.gameSpeed !== this.lastSpeed) {
            this.lastSpeed = gm.gameSpeed;
            const paused = (gm.gameSpeed === 0);
            el.playPause.textContent = paused ? 'Play' : 'Pause';
            el.playPause.classList.toggle('active', paused);
            el.speed1.classList.toggle('active', !paused && gm.gameSpeed === 1);
            el.speed2.classList.toggle('active', !paused && gm.gameSpeed === 2);
            el.speed3.classList.toggle('active', !paused && gm.gameSpeed === 3);
        }

        // Ship counts and spawns per minute
        this.setText(el.valT1, String(gm.frameStats.teamShips[1] || 0));
        this.setText(el.valT2, String(gm.frameStats.teamShips[2] || 0));

        const durationMins = Math.max(0.05, gm.gameTime / 60);
        const t1Spawned = gm.telemetry.summary.team1.shipsSpawned;
        const t2Spawned = gm.telemetry.summary.team2.shipsSpawned;
        this.setText(el.spmT1, (t1Spawned / durationMins).toFixed(1));
        this.setText(el.spmT2, (t2Spawned / durationMins).toFixed(1));

        const c = gm.controls;
        this.setText(el.send, c.enabled ? Math.round(c.sendRatio * 100) + '%' : '--');

        this.rollDeathToll();

        this.updateDevPanel();
    }

    // Death toll: the shown number chases the real one so kills roll up instead of jumping
    rollDeathToll() {
        const now = performance.now();
        const dt = this.lastTick === null ? 0 : Math.min(0.1, (now - this.lastTick) / 1000);
        this.lastTick = now;

        const ROLL_RATE = 6;      // higher = snappier catch-up
        const MIN_SPEED = 400;    // people per second, so it always finishes
        const perShip = window.GAME_CONFIG.DEATH_TOLL_PER_SHIP;

        for (const team of [1, 2]) {
            const lost = this.gm.telemetry.summary['team' + team].shipsLost;
            const target = lost * perShip;
            let cur = this.deadShown[team];
            if (cur < target) {
                const gap = target - cur;
                cur += Math.min(gap, Math.max(gap * (1 - Math.exp(-ROLL_RATE * dt)), MIN_SPEED * dt));
                this.deadShown[team] = cur;
            }
            const text = Math.round(cur).toLocaleString('en-US');
            this.setText(team === 1 ? this.el.deadT1 : this.el.deadT2, text);
        }
    }

    updateDevPanel() {
        const gm = this.gm;
        if (this.el.devPanel.classList.contains('hidden')) return;

        const fill = (el, teamId, ai) => {
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

        fill(this.el.devT1, 1, gm.aiController1);
        fill(this.el.devT2, 2, gm.aiController2);
    }
}