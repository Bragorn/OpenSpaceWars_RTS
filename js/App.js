class App {
    constructor() {
        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        this.canvas = document.getElementById(dom.CANVAS_ID || 'game');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        this.state = 'MENU';
        this.selectedSlotNum = 1;
        this.lastTime = performance.now();
        this.lastSimReport = null;

        this.t1SpawnCount = 0;
        this.t2SpawnCount = 0;

        this.registry = typeof MapRegistry === 'function' ? new MapRegistry() : null;

        this.bindEvents();
        this.populateFactionDropdowns();
        this.showMainMenu();
        this.loop(performance.now());
    }

    bindEvents() {
        document.getElementById('btn-main-play')?.addEventListener('click', () => this.showMapSelect());
        document.getElementById('btn-map-back')?.addEventListener('click', () => this.showMainMenu());
        document.getElementById('btn-map-start')?.addEventListener('click', () => this.launchSelectedMap());
        document.getElementById('btn-restart')?.addEventListener('click', () => this.showMapSelect());

        document.getElementById('btn-batch-sim')?.addEventListener('click', () => this.openSimSetupModal());
        document.getElementById('btn-close-sim')?.addEventListener('click', () => this.closeSimModal());
        document.getElementById('btn-close-sim-running')?.addEventListener('click', () => this.closeSimModal());
        
        document.getElementById('sim-combo-mode')?.addEventListener('change', (e) => this.toggleSimMatchOptions(e.target.value));
        document.getElementById('btn-start-sim-run')?.addEventListener('click', () => this.runConfiguredSimulation());
        document.getElementById('btn-sim-reset')?.addEventListener('click', () => this.showSimSetupView());

        document.getElementById('select-game-mode')?.addEventListener('change', (e) => {
            const p1Label = document.getElementById('p1-header-label');
            const p2Label = document.getElementById('p2-header-label');
            if (e.target.value === 'CPU_VS_CPU') {
                if (p1Label) p1Label.textContent = 'CPU 1 (TEAM 1)';
                if (p2Label) p2Label.textContent = 'CPU 2 (TEAM 2)';
            } else {
                if (p1Label) p1Label.textContent = 'PLAYER 1';
                if (p2Label) p2Label.textContent = 'CPU ENEMY';
            }
        });
    }

    populateFactionDropdowns() {
        const playerSelect = document.getElementById('select-player-faction');
        const enemySelect = document.getElementById('select-enemy-faction');
        if (!playerSelect || !enemySelect || typeof FACTION_DATA === 'undefined') return;

        playerSelect.innerHTML = '';
        enemySelect.innerHTML = '';

        Object.keys(FACTION_DATA).forEach((key) => {
            const fac = FACTION_DATA[key];
            
            const optPlayer = document.createElement('option');
            optPlayer.value = fac.id;
            optPlayer.textContent = `${fac.name} (${fac.id})`;
            if (fac.id === 'HUMAN') optPlayer.selected = true;
            playerSelect.appendChild(optPlayer);

            const optEnemy = document.createElement('option');
            optEnemy.value = fac.id;
            optEnemy.textContent = `${fac.name} (${fac.id})`;
            if (fac.id === 'PROTOCOL') optEnemy.selected = true;
            enemySelect.appendChild(optEnemy);
        });

        this.syncFactionDropdowns(playerSelect, enemySelect);
        this.updateMenuFactionTheme();

        playerSelect.addEventListener('change', () => {
            this.syncFactionDropdowns(playerSelect, enemySelect);
            this.updateMenuFactionTheme();
        });
        enemySelect.addEventListener('change', () => {
            this.syncFactionDropdowns(enemySelect, playerSelect);
            this.updateMenuFactionTheme();
        });
    }

    updateMenuFactionTheme() {
        if (typeof FACTION_DATA === 'undefined') return;

        const p1Val = document.getElementById('select-player-faction')?.value || 'HUMAN';
        const p2Val = document.getElementById('select-enemy-faction')?.value || 'PROTOCOL';

        const f1 = FACTION_DATA[p1Val] || FACTION_DATA.HUMAN;
        const f2 = FACTION_DATA[p2Val] || FACTION_DATA.PROTOCOL;

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

    syncFactionDropdowns(sourceSelect, targetSelect) {
        if (!sourceSelect || !targetSelect) return;
        const selectedValue = sourceSelect.value;

        Array.from(targetSelect.options).forEach(opt => {
            opt.disabled = (opt.value === selectedValue);
        });

        if (targetSelect.value === selectedValue) {
            const firstAvailable = Array.from(targetSelect.options).find(opt => !opt.disabled);
            if (firstAvailable) {
                targetSelect.value = firstAvailable.value;
            }
        }
    }

    openSimSetupModal() {
        const modal = document.getElementById('sim-modal');
        if (!modal) return;

        this.populateSimSetupDropdowns();
        this.showSimSetupView();
        modal.classList.remove('hidden');
    }

    closeSimModal() {
        const modal = document.getElementById('sim-modal');
        if (modal) modal.classList.add('hidden');
    }

    showSimSetupView() {
        document.getElementById('sim-setup-view')?.classList.remove('hidden');
        document.getElementById('sim-running-view')?.classList.add('hidden');
    }

    showSimRunningView() {
        document.getElementById('sim-setup-view')?.classList.add('hidden');
        document.getElementById('sim-running-view')?.classList.remove('hidden');
    }

    toggleSimMatchOptions(mode) {
        const specOptions = document.getElementById('sim-specific-options');
        if (!specOptions) return;

        if (mode === 'SPECIFIC') {
            specOptions.classList.remove('hidden');
        } else {
            specOptions.classList.add('hidden');
        }
    }

    populateSimSetupDropdowns() {
        const f1Select = document.getElementById('sim-faction-1');
        const f2Select = document.getElementById('sim-faction-2');
        const mapSelect = document.getElementById('sim-map-select');

        if (!f1Select || !f2Select || !mapSelect || typeof FACTION_DATA === 'undefined') return;

        f1Select.innerHTML = '';
        f2Select.innerHTML = '';
        mapSelect.innerHTML = '<option value="ALL">All Maps</option>';

        Object.keys(FACTION_DATA).forEach((key) => {
            const fac = FACTION_DATA[key];
            const opt1 = new Option(`${fac.name} (${fac.id})`, fac.id);
            const opt2 = new Option(`${fac.name} (${fac.id})`, fac.id);

            if (fac.id === 'HUMAN') opt1.selected = true;
            if (fac.id === 'PROTOCOL') opt2.selected = true;

            f1Select.add(opt1);
            f2Select.add(opt2);
        });

        if (this.registry) {
            const maps = this.registry.getAllMaps ? this.registry.getAllMaps() : [];
            maps.forEach((map, idx) => {
                const slotNum = idx + 1;
                mapSelect.add(new Option(`Map ${slotNum}: ${map.name}`, slotNum));
            });
        }
    }

    async runConfiguredSimulation() {
        const output = document.getElementById('sim-output');
        const progress = document.getElementById('sim-progress');
        const matchesInput = document.getElementById('sim-matches-count');
        const comboMode = document.getElementById('sim-combo-mode')?.value || 'ALL';

        if (!output || typeof BatchSimulator === 'undefined') return;

        const matchesCount = matchesInput ? (parseInt(matchesInput.value, 10) || 10) : 10;
        
        const simOptions = {
            matchesPerPair: matchesCount,
            mode: comboMode,
            faction1: document.getElementById('sim-faction-1')?.value || 'HUMAN',
            faction2: document.getElementById('sim-faction-2')?.value || 'PROTOCOL',
            mapTarget: document.getElementById('sim-map-select')?.value || 'ALL'
        };

        this.showSimRunningView();
        output.innerHTML = '<p class="sim-loading">INITIALIZING BATCH SIMULATION SUITE...</p>';
        progress.textContent = '0%';

        const report = await BatchSimulator.runFullSuite(this.registry, simOptions, (done, total) => {
            const pct = Math.round((done / total) * 100);
            progress.textContent = `${pct}% (${done}/${total} MATCHES)`;
        });

        this.lastSimReport = report;
        this.renderSimReport(report);
    }

    renderSimReport(report) {
        const output = document.getElementById('sim-output');
        if (!output || !report) return;

        const gm = report.globalMetrics || {};
        const sortedFactions = [...(report.factions || [])].sort((a, b) => 
            (report.factionStats[b]?.winRate || 0) - (report.factionStats[a]?.winRate || 0)
        );

        let textSummary = `=== BATCH SIMULATION REPORT (${report.totalMatches} MATCHES) ===\n\n`;
        textSummary += `MATCH PACING & GLOBAL METRICS:\n`;
        textSummary += `• Match Duration Spread: Min ${gm.minDuration}s | Median ${gm.medianDuration}s | Max ${gm.maxDuration}s | Avg ${gm.avgDuration}s\n`;
        textSummary += `• Timeout Resolved Matches: ${gm.timeoutWinRate}%\n`;
        textSummary += `• First Neutral Capture Time: ${gm.avgFirstCaptureTime || 'N/A'}s\n`;
        textSummary += `• Avg Contested Planet Time: ${gm.avgContestedTime}s\n\n`;

        textSummary += `FACTION PERFORMANCE DETAILS:\n`;

        sortedFactions.forEach(fKey => {
            const st = report.factionStats[fKey];
            if (!st) return;
            const facName = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[fKey]) ? FACTION_DATA[fKey].name : fKey;

            textSummary += `[${facName.toUpperCase()} (${fKey})]\n`;
            textSummary += `  - Win Rate: ${st.winRate}% (${st.wins}/${st.matches} wins)\n`;
            textSummary += `  - Combat: KDR ${st.kdr} | Dmg Eff ${st.damageEfficiency} | Kills ${st.avgKills} | Losses ${st.avgLosses}\n`;
            textSummary += `  - Economy: SPM ${st.spm} | Prod-to-Combat Eff ${st.prodCombatEfficiency}%\n`;
            textSummary += `  - Macro: Avg Control ${st.avgPlanetShare}% | Majority Time ${st.controlMajorityPct}% | Comeback Win Rate ${st.comebackRate}%\n`;
            textSummary += `  - Movement: Transit Ratio ${st.transitRatio}% | Idle Fleet Ratio ${st.idleRatio}% | Avg Dispatch ${st.avgDispatchSize}%\n\n`;
        });

        let html = `
            <div style="margin-bottom: 10px; text-align: right;">
                <button id="btn-copy-sim-text" style="padding: 6px 14px; background: #00aaff; color: #000; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">
                    Copy Structured Summary
                </button>
            </div>

            <div class="sim-summary-grid">
                <div class="sim-card">
                    <h4>DURATION SPREAD</h4>
                    <p class="sim-num">${gm.minDuration}s - ${gm.maxDuration}s</p>
                    <span style="font-size: 9px; color: #94a3b8;">Avg: ${gm.avgDuration}s | Med: ${gm.medianDuration}s</span>
                </div>
                <div class="sim-card">
                    <h4>TIMEOUT RATE</h4>
                    <p class="sim-num">${gm.timeoutWinRate}%</p>
                    <span style="font-size: 9px; color: #94a3b8;">Resolved by Majority</span>
                </div>
                <div class="sim-card">
                    <h4>FIRST CAPTURE</h4>
                    <p class="sim-num">${gm.avgFirstCaptureTime || 'N/A'}s</p>
                    <span style="font-size: 9px; color: #94a3b8;">Contested: ${gm.avgContestedTime}s</span>
                </div>
            </div>

            <h3 class="sim-section-title">FACTION OVERVIEW TABLE</h3>
            <table class="sim-table">
                <thead>
                    <tr>
                        <th>FACTION</th>
                        <th>WIN RATE</th>
                        <th>KDR</th>
                        <th>DMG EFF</th>
                        <th>PROD EFF</th>
                        <th>SPM</th>
                        <th>CONTROL</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedFactions.forEach(fKey => {
            const st = report.factionStats[fKey];
            if (!st) return;
            const facName = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[fKey]) ? FACTION_DATA[fKey].name : fKey;
            const winColor = st.winRate >= 55 ? '#00ffcc' : (st.winRate <= 45 ? '#ff4466' : '#ffffff');

            html += `
                <tr>
                    <td style="font-weight: bold; color: #00aaff;">${facName}</td>
                    <td style="color: ${winColor}; font-weight: bold;">${st.winRate}%</td>
                    <td>${st.kdr}</td>
                    <td>${st.damageEfficiency}</td>
                    <td>${st.prodCombatEfficiency}%</td>
                    <td>${st.spm}</td>
                    <td>${st.avgPlanetShare}%</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>

            <h3 class="sim-section-title">FORMATTED REPORT COPY</h3>
            <textarea id="sim-text-export" readonly style="width: 100%; height: 110px; background: #111; color: #00ffcc; font-family: monospace; font-size: 9px; padding: 8px; border: 1px solid #333; border-radius: 4px; resize: none;">${textSummary}</textarea>
        `;

        output.innerHTML = html;

        document.getElementById('btn-copy-sim-text')?.addEventListener('click', () => {
            const txt = document.getElementById('sim-text-export');
            if (txt) {
                txt.select();
                navigator.clipboard.writeText(txt.value);
                const btn = document.getElementById('btn-copy-sim-text');
                if (btn) btn.textContent = '✓ Copied Summary!';
            }
        });
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

        const menuMain = document.getElementById('menu-main');
        const menuMap = document.getElementById('menu-map-select');

        if (menuMain) menuMain.style.display = 'none';
        if (menuMap) menuMap.style.display = 'flex';

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

        const width = this.canvas ? this.canvas.width : window.innerWidth;
        const height = this.canvas ? this.canvas.height : window.innerHeight;
        
        const scaledMap = this.registry.getScaledMap(this.selectedSlotNum, width, height);

        const playerFaction = document.getElementById('select-player-faction')?.value || 'HUMAN';
        const enemyFaction = document.getElementById('select-enemy-faction')?.value || 'PROTOCOL';
        const gameMode = document.getElementById('select-game-mode')?.value || 'PLAYER_VS_CPU';

        this.state = 'GAME';
        this.clearScreen();
        
        const menuMap = document.getElementById('menu-map-select');
        if (menuMap) menuMap.style.display = 'none';

        // Apply dynamic faction colors to the in-game HUD cards
        const f1 = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[playerFaction]) ? FACTION_DATA[playerFaction] : { name: playerFaction, color: '#00aaff' };
        const f2 = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[enemyFaction]) ? FACTION_DATA[enemyFaction] : { name: enemyFaction, color: '#ff3355' };

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

        if (window.gameManager) {
            window.gameManager.start(scaledMap, playerFaction, enemyFaction, gameMode);
        }
    }

    updateInGameHUD() {
        if (!window.gameManager || !window.gameManager.ships) return;

        const gm = window.gameManager;
        const t1Count = gm.ships.filter(s => s && !s.dead && s.owner === 1).length;
        const t2Count = gm.ships.filter(s => s && !s.dead && s.owner === 2).length;

        const valT1 = document.getElementById('hud-val-t1');
        const valT2 = document.getElementById('hud-val-t2');

        if (valT1) valT1.textContent = t1Count;
        if (valT2) valT2.textContent = t2Count;

        // Calculate Live SPM
        const durationMins = Math.max(0.05, gm.gameTime / 60);
        const t1Spawned = gm.telemetry ? gm.telemetry.summary.team1.shipsSpawned : 0;
        const t2Spawned = gm.telemetry ? gm.telemetry.summary.team2.shipsSpawned : 0;

        const spmT1 = document.getElementById('hud-spm-t1');
        const spmT2 = document.getElementById('hud-spm-t2');

        if (spmT1) spmT1.textContent = (t1Spawned / durationMins).toFixed(1);
        if (spmT2) spmT2.textContent = (t2Spawned / durationMins).toFixed(1);

        // Display AI State Strings
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