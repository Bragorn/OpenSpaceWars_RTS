class BatchSimulator {
    static async runFullSuite(registry, options = {}, onProgress = null) {
        const matchesPerPair = options.matchesPerPair || 10;
        const mode = options.mode || 'ALL';
        const faction1Override = options.faction1 || 'HUMAN';
        const faction2Override = options.faction2 || 'PROTOCOL';
        const mapTarget = options.mapTarget || 'ALL';

        const mapList = registry && typeof registry.getAllMaps === 'function' ? registry.getAllMaps() : [];
        const factionKeys = typeof FACTION_DATA !== 'undefined' ? Object.keys(FACTION_DATA) : ['HUMAN', 'PROTOCOL'];

        let matchups = [];

        if (mode === 'SPECIFIC') {
            const mapsToRun = mapTarget === 'ALL' 
                ? mapList.map((_, idx) => idx + 1) 
                : [parseInt(mapTarget, 10)];

            mapsToRun.forEach(slotNum => {
                matchups.push({ slotNum, f1: faction1Override, f2: faction2Override });
            });
        } else {
            mapList.forEach((_, idx) => {
                const slotNum = idx + 1;
                for (let i = 0; i < factionKeys.length; i++) {
                    for (let j = i + 1; j < factionKeys.length; j++) {
                        matchups.push({ slotNum, f1: factionKeys[i], f2: factionKeys[j] });
                    }
                }
            });
        }

        if (matchups.length === 0) {
            matchups.push({ slotNum: 1, f1: faction1Override, f2: faction2Override });
        }

        const totalMatches = matchups.length * matchesPerPair;
        let completedMatches = 0;

        const results = {
            totalMatches,
            factions: factionKeys,
            factionStats: {},
            mapStats: {}
        };

        factionKeys.forEach(f => {
            results.factionStats[f] = { 
                wins: 0, 
                matches: 0, 
                totalDuration: 0, 
                planetShareSum: 0,
                killsSum: 0,
                lossesSum: 0, 
                winRate: 0, 
                avgDuration: 0, 
                avgPlanetShare: 0,
                avgKills: 0,
                avgLosses: 0
            };
        });

        mapList.forEach((m, idx) => {
            const slotNum = idx + 1;
            results.mapStats[slotNum] = { 
                name: m ? (m.name || `Arena ${slotNum}`) : `Arena ${slotNum}`, 
                matches: 0, 
                totalDuration: 0, 
                avgDuration: 0 
            };
        });

        const MACRO_DT = 0.1; 
        const MAX_TICKS = 1800;

        const startTime = performance.now();

        for (const matchDef of matchups) {
            const rawMap = registry && typeof registry.getScaledMap === 'function'
                ? registry.getScaledMap(matchDef.slotNum, 1200, 800)
                : null;

            for (let m = 0; m < matchesPerPair; m++) {
                const matchResult = this.runSingleMatchFast(rawMap, matchDef.f1, matchDef.f2, MACRO_DT, MAX_TICKS);
                
                const { winnerTeamId, durationSeconds, team1Share, team2Share, telemetrySummary } = matchResult;

                const f1 = results.factionStats[matchDef.f1];
                if (f1) {
                    f1.matches++;
                    f1.totalDuration += durationSeconds;
                    f1.planetShareSum += team1Share;
                    if (winnerTeamId === 1) f1.wins++;

                    if (telemetrySummary && telemetrySummary.team1) {
                        f1.killsSum += telemetrySummary.team1.shipsKilled || 0;
                        f1.lossesSum += telemetrySummary.team1.shipsLost || 0;
                    }
                }

                const f2 = results.factionStats[matchDef.f2];
                if (f2) {
                    f2.matches++;
                    f2.totalDuration += durationSeconds;
                    f2.planetShareSum += team2Share;
                    if (winnerTeamId === 2) f2.wins++;

                    if (telemetrySummary && telemetrySummary.team2) {
                        f2.killsSum += telemetrySummary.team2.shipsKilled || 0;
                        f2.lossesSum += telemetrySummary.team2.shipsLost || 0;
                    }
                }

                const mapSt = results.mapStats[matchDef.slotNum];
                if (mapSt) {
                    mapSt.matches++;
                    mapSt.totalDuration += durationSeconds;
                }

                completedMatches++;

                if (completedMatches % 20 === 0 || completedMatches === totalMatches) {
                    if (typeof onProgress === 'function') {
                        onProgress(completedMatches, totalMatches);
                    }
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }

        Object.keys(results.factionStats).forEach(f => {
            const st = results.factionStats[f];
            if (st.matches > 0) {
                st.winRate = Math.round((st.wins / st.matches) * 100);
                st.avgDuration = Math.round(st.totalDuration / st.matches);
                st.avgPlanetShare = Math.round(st.planetShareSum / st.matches);
                st.avgKills = Math.round(st.killsSum / st.matches);
                st.avgLosses = Math.round(st.lossesSum / st.matches);
            }
        });

        Object.keys(results.mapStats).forEach(m => {
            const st = results.mapStats[m];
            if (st.matches > 0) {
                st.avgDuration = Math.round(st.totalDuration / st.matches);
            }
        });

        results.executionTimeMs = Math.round(performance.now() - startTime);
        return results;
    }

    static runSingleMatchFast(mapData, faction1Id, faction2Id, dt, maxTicks) {
        const simManager = new GameManager(true);
        simManager.start(mapData, faction1Id, faction2Id, 'CPU_VS_CPU');

        let ticks = 0;

        while (simManager.isRunning && ticks < maxTicks) {
            simManager.update(dt);
            ticks++;
        }

        let winnerTeamId = simManager.winnerId || 0;

        const totalPlanets = simManager.planets && simManager.planets.length > 0 ? simManager.planets.length : 1;
        let t1Planets = 0;
        let t2Planets = 0;

        if (simManager.planets) {
            simManager.planets.forEach(p => {
                if (p.owner === 1) t1Planets++;
                if (p.owner === 2) t2Planets++;
            });
        }

        if (winnerTeamId === 0) {
            if (t1Planets > t2Planets) winnerTeamId = 1;
            else if (t2Planets > t1Planets) winnerTeamId = 2;
        }

        return {
            winnerTeamId,
            durationSeconds: Math.round(ticks * dt),
            ticksProcessed: ticks,
            team1Share: Math.round((t1Planets / totalPlanets) * 100),
            team2Share: Math.round((t2Planets / totalPlanets) * 100),
            telemetrySummary: simManager.telemetry ? simManager.telemetry.getSummary() : null
        };
    }
}

if (typeof window !== 'undefined') {
    window.BatchSimulator = BatchSimulator;
}