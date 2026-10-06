class App {
    constructor() {
        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        this.canvas = document.getElementById(dom.CANVAS_ID || 'game');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        this.state = 'MENU';
        this.selectedSlotNum = 1;
        this.lastTime = performance.now();
        this.lastSimReport = null;

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

        // Simulation Modal Triggers
        document.getElementById('btn-batch-sim')?.addEventListener('click', () => this.openSimSetupModal());
        document.getElementById('btn-close-sim')?.addEventListener('click', () => this.closeSimModal());
        document.getElementById('btn-close-sim-running')?.addEventListener('click', () => this.closeSimModal());
        
        // Simulation Controls
        document.getElementById('sim-combo-mode')?.addEventListener('change', (e) => this.toggleSimMatchOptions(e.target.value));
        document.getElementById('btn-start-sim-run')?.addEventListener('click', () => this.runConfiguredSimulation());
        document.getElementById('btn-sim-reset')?.addEventListener('click', () => this.showSimSetupView());

        // Data Exporters
        document.getElementById('btn-export-json')?.addEventListener('click', () => this.exportSimData('json'));
        document.getElementById('btn-export-csv')?.addEventListener('click', () => this.exportSimData('csv'));

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

        playerSelect.addEventListener('change', () => this.syncFactionDropdowns(playerSelect, enemySelect));
        enemySelect.addEventListener('change', () => this.syncFactionDropdowns(enemySelect, playerSelect));
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
        output.innerHTML = '<p class="sim-loading">INITIALIZING HEADLESS BATCH SIMULATION...</p>';
        progress.textContent = '0%';

        // Execute batch test using configured options
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

        let html = `
            <div class="sim-summary-grid">
                <div class="sim-card">
                    <h4>TOTAL MATCHES</h4>
                    <p class="sim-num">${report.totalMatches}</p>
                </div>
                <div class="sim-card">
                    <h4>FACTIONS TESTED</h4>
                    <p class="sim-num">${report.factions ? report.factions.length : 0}</p>
                </div>
                <div class="sim-card">
                    <h4>MAPS TESTED</h4>
                    <p class="sim-num">${Object.keys(report.mapStats || {}).length}</p>
                </div>
            </div>

            <h3 class="sim-section-title">FACTION PERFORMANCE OVERVIEW</h3>
            <table class="sim-table">
                <thead>
                    <tr>
                        <th>FACTION</th>
                        <th>WIN RATE</th>
                        <th>WINS / MATCHES</th>
                        <th>AVG MATCH DURATION</th>
                        <th>AVG PLANET CONTROL</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const sortedFactions = [...(report.factions || [])].sort((a, b) => 
            (report.factionStats[b]?.winRate || 0) - (report.factionStats[a]?.winRate || 0)
        );

        sortedFactions.forEach(fKey => {
            const st = report.factionStats[fKey];
            if (!st) return;
            const facName = FACTION_DATA[fKey]?.name || fKey;
            const winColor = st.winRate >= 55 ? '#00ffcc' : (st.winRate <= 45 ? '#ff4466' : '#ffffff');

            html += `
                <tr>
                    <td style="font-weight: bold; color: #00aaff;">${facName} (${fKey})</td>
                    <td style="color: ${winColor}; font-weight: bold;">${st.winRate}%</td>
                    <td>${st.wins} / ${st.matches}</td>
                    <td>${st.avgDuration}s</td>
                    <td>${st.avgPlanetShare}%</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>

            <h3 class="sim-section-title">MAP DURATION BREAKDOWN</h3>
            <div class="sim-map-grid">
        `;

        Object.keys(report.mapStats || {}).forEach(mapKey => {
            const ms = report.mapStats[mapKey];
            html += `
                <div class="sim-card">
                    <h4 style="color: #00ffcc;">Map ${mapKey}: ${ms.name}</h4>
                    <p>Avg Length: <strong>${ms.avgDuration}s</strong></p>
                    <p>Total Played: ${ms.matches}</p>
                </div>
            `;
        });

        html += `</div>`;
        output.innerHTML = html;
    }

    exportSimData(format = 'json') {
        if (!this.lastSimReport) {
            alert("No simulation data available to export. Run a simulation first.");
            return;
        }

        const report = this.lastSimReport;
        let dataStr = "";
        let filename = `OpenSpaceWars_SimData_${Date.now()}`;

        if (format === 'json') {
            dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
            filename += ".json";
        } else if (format === 'csv') {
            let csvLines = ["FactionKey,FactionName,MatchesPlayed,Wins,WinRatePercent,AvgDurationSec,AvgPlanetSharePercent"];
            
            Object.keys(report.factionStats || {}).forEach(fKey => {
                const st = report.factionStats[fKey];
                const name = (typeof FACTION_DATA !== 'undefined' && FACTION_DATA[fKey]) ? FACTION_DATA[fKey].name : fKey;
                csvLines.push(`"${fKey}","${name}",${st.matches},${st.wins},${st.winRate},${st.avgDuration},${st.avgPlanetShare}`);
            });

            dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvLines.join("\n"));
            filename += ".csv";
        }

        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
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

        const menuMain = document.getElementById('menu-main');
        const menuMap = document.getElementById('menu-map-select');

        if (menuMain) menuMain.style.display = 'block';
        if (menuMap) menuMap.style.display = 'none';
    }

    showMapSelect() {
        this.state = 'MAP_SELECT';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();

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

        if (window.gameManager) {
            window.gameManager.start(scaledMap, playerFaction, enemyFaction, gameMode);
        }
    }

    loop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000 || 0;
        this.lastTime = timestamp;

        if (this.state === 'GAME' && window.gameManager) {
            window.gameManager.update(deltaTime);
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