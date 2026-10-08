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
        let timeoutMatchesCount = 0;

        const durations = [];

        const results = {
            totalMatches,
            factions: factionKeys,
            factionStats: {},
            globalMetrics: {
                minDuration: Infinity,
                maxDuration: 0,
                medianDuration: 0,
                avgDuration: 0,
                timeoutWinRate: 0,
                avgFirstCaptureTime: 0,
                avgContestedTime: 0
            }
        };

        let firstCaptureSum = 0;
        let contestedTimeSum = 0;
        let validCaptureCount = 0;

        factionKeys.forEach(f => {
            results.factionStats[f] = { 
                wins: 0, 
                matches: 0, 
                totalDuration: 0, 
                planetShareSum: 0,
                killsSum: 0,
                lossesSum: 0, 
                spawnedSum: 0,
                combatParticipantsSum: 0,
                damageDealtSum: 0,
                damageReceivedSum: 0,
                majorityTimeSum: 0,
                comebackWins: 0,
                comebackAttempts: 0,
                transitTimeSum: 0,
                activeTimeSum: 0,
                idleTimeSum: 0,
                orbitTimeSum: 0,
                dispatchSum: 0,
                dispatchCount: 0
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
                
                const { winnerTeamId, durationSeconds, team1Share, team2Share, telemetrySummary, isTimeout } = matchResult;

                durations.push(durationSeconds);
                if (isTimeout) timeoutMatchesCount++;

                if (telemetrySummary) {
                    if (telemetrySummary.firstCaptureTime !== null) {
                        firstCaptureSum += telemetrySummary.firstCaptureTime;
                        validCaptureCount++;
                    }
                    contestedTimeSum += telemetrySummary.contestedTimeTotal || 0;
                }

                // Process Team 1 (f1)
                this.accumulateTeamStats(results.factionStats[matchDef.f1], 1, winnerTeamId, durationSeconds, team1Share, telemetrySummary);

                // Process Team 2 (f2)
                this.accumulateTeamStats(results.factionStats[matchDef.f2], 2, winnerTeamId, durationSeconds, team2Share, telemetrySummary);

                completedMatches++;

                if (completedMatches % 20 === 0 || completedMatches === totalMatches) {
                    if (typeof onProgress === 'function') {
                        onProgress(completedMatches, totalMatches);
                    }
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }

        // Calculate Global Metrics
        durations.sort((a, b) => a - b);
        const sumDuration = durations.reduce((a, b) => a + b, 0);

        results.globalMetrics.minDuration = durations[0] || 0;
        results.globalMetrics.maxDuration = durations[durations.length - 1] || 0;
        results.globalMetrics.medianDuration = durations[Math.floor(durations.length / 2)] || 0;
        results.globalMetrics.avgDuration = Math.round(sumDuration / totalMatches);
        results.globalMetrics.timeoutWinRate = Math.round((timeoutMatchesCount / totalMatches) * 100);
        results.globalMetrics.avgFirstCaptureTime = validCaptureCount > 0 ? Math.round(firstCaptureSum / validCaptureCount) : 0;
        results.globalMetrics.avgContestedTime = Math.round(contestedTimeSum / totalMatches);

        // Finalize Faction Stats
        Object.keys(results.factionStats).forEach(f => {
            const st = results.factionStats[f];
            if (st.matches > 0) {
                st.winRate = Math.round((st.wins / st.matches) * 100);
                st.avgKills = Math.round(st.killsSum / st.matches);
                st.avgLosses = Math.round(st.lossesSum / st.matches);
                st.kdr = st.lossesSum > 0 ? (st.killsSum / st.lossesSum).toFixed(2) : st.killsSum.toFixed(2);
                st.damageEfficiency = st.damageReceivedSum > 0 ? (st.damageDealtSum / st.damageReceivedSum).toFixed(2) : st.damageDealtSum.toFixed(2);
                st.prodCombatEfficiency = st.spawnedSum > 0 ? Math.round((st.combatParticipantsSum / st.spawnedSum) * 100) : 0;
                st.spm = st.totalDuration > 0 ? ((st.spawnedSum / st.totalDuration) * 60).toFixed(1) : 0;
                st.avgPlanetShare = Math.round(st.planetShareSum / st.matches);
                st.controlMajorityPct = st.totalDuration > 0 ? Math.round((st.majorityTimeSum / st.totalDuration) * 100) : 0;
                st.comebackRate = st.comebackAttempts > 0 ? Math.round((st.comebackWins / st.comebackAttempts) * 100) : 0;
                st.transitRatio = st.activeTimeSum > 0 ? Math.round((st.transitTimeSum / st.activeTimeSum) * 100) : 0;
                st.idleRatio = st.orbitTimeSum > 0 ? Math.round((st.idleTimeSum / st.orbitTimeSum) * 100) : 0;
                st.avgDispatchSize = st.dispatchCount > 0 ? Math.round((st.dispatchSum / st.dispatchCount) * 100) : 50;
            }
        });

        results.executionTimeMs = Math.round(performance.now() - startTime);
        return results;
    }

    static accumulateTeamStats(st, teamId, winnerTeamId, durationSeconds, planetShare, telemetrySummary) {
        if (!st) return;

        st.matches++;
        st.totalDuration += durationSeconds;
        st.planetShareSum += planetShare;
        if (winnerTeamId === teamId) st.wins++;

        if (telemetrySummary && telemetrySummary.teams) {
            const tData = telemetrySummary.teams[`team${teamId}`];
            if (tData) {
                st.killsSum += tData.shipsKilled || 0;
                st.lossesSum += tData.shipsLost || 0;
                st.spawnedSum += tData.shipsSpawned || 0;
                st.combatParticipantsSum += tData.combatParticipants || 0;
                st.damageDealtSum += tData.damageDealt || 0;
                st.damageReceivedSum += tData.damageReceived || 0;
                st.majorityTimeSum += tData.majorityTime || 0;
                st.transitTimeSum += tData.transitTimeTotal || 0;
                st.activeTimeSum += tData.activeShipSamples || 0;
                st.idleTimeSum += tData.idleShipSamples || 0;
                st.orbitTimeSum += tData.orbitTimeTotal || 0;

                if (tData.wasBelow30Percent) {
                    st.comebackAttempts++;
                    if (winnerTeamId === teamId) st.comebackWins++;
                }

                if (tData.dispatchSizes && tData.dispatchSizes.length > 0) {
                    const dispSum = tData.dispatchSizes.reduce((a, b) => a + b, 0);
                    st.dispatchSum += dispSum;
                    st.dispatchCount += tData.dispatchSizes.length;
                }
            }
        }
    }

    static runSingleMatchFast(mapData, faction1Id, faction2Id, dt, maxTicks) {
        const simManager = new GameManager(true);
        simManager.start(mapData, faction1Id, faction2Id, 'CPU_VS_CPU');

        let ticks = 0;

        while (simManager.isRunning && ticks < maxTicks) {
            simManager.update(dt);
            ticks++;
        }

        const isTimeout = ticks >= maxTicks;
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
            isTimeout,
            team1Share: Math.round((t1Planets / totalPlanets) * 100),
            team2Share: Math.round((t2Planets / totalPlanets) * 100),
            telemetrySummary: simManager.telemetry ? simManager.telemetry.getSummary() : null
        };
    }
}

if (typeof window !== 'undefined') {
    window.BatchSimulator = BatchSimulator;
}