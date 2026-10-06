class BatchSimulator {
    /**
     * Executes headless batch matches based on numeric count or configuration object.
     * @param {MapRegistry} registry 
     * @param {number|Object} options - Number of matches OR simulation configuration object
     * @param {Function} onProgress - Progress callback (completed, total)
     * @returns {Promise<Object>} Compiled report of win rates, durations, and map metrics
     */
    static async runFullSuite(registry, options, onProgress) {
        if (!registry) {
            console.error("BatchSimulator: No MapRegistry provided.");
            return null;
        }

        // 1. Parse Options & Default Values
        let matchesPerPair = 10;
        let mode = 'ALL';
        let faction1 = null;
        let faction2 = null;
        let mapTarget = 'ALL';

        if (typeof options === 'number') {
            matchesPerPair = options;
        } else if (typeof options === 'object' && options !== null) {
            matchesPerPair = parseInt(options.matchesPerPair, 10) || 10;
            mode = options.mode || 'ALL';
            faction1 = options.faction1 || null;
            faction2 = options.faction2 || null;
            mapTarget = options.mapTarget || 'ALL';
        }

        // 2. Resolve Maps to Test
        const allMaps = registry.getAllMaps ? registry.getAllMaps() : [];
        let mapsToTest = [];

        if (mapTarget !== 'ALL' && mapTarget !== null) {
            const targetIdx = parseInt(mapTarget, 10) - 1;
            if (allMaps[targetIdx]) {
                mapsToTest = [{ slotNum: parseInt(mapTarget, 10), mapData: allMaps[targetIdx] }];
            }
        }

        if (mapsToTest.length === 0) {
            mapsToTest = allMaps.map((mapData, idx) => ({ slotNum: idx + 1, mapData }));
        }

        // 3. Resolve Matchup Pairs
        const allFactionKeys = typeof FACTION_DATA !== 'undefined' ? Object.keys(FACTION_DATA) : ['HUMAN', 'PROTOCOL'];
        let pairs = [];

        if (mode === 'SPECIFIC' && faction1 && faction2) {
            pairs = [{ f1: faction1, f2: faction2 }];
        } else {
            // Round-robin pairing across all registered factions
            for (let i = 0; i < allFactionKeys.length; i++) {
                for (let j = i + 1; j < allFactionKeys.length; j++) {
                    pairs.push({ f1: allFactionKeys[i], f2: allFactionKeys[j] });
                }
            }
        }

        const totalMatches = mapsToTest.length * pairs.length * matchesPerPair;
        if (totalMatches === 0) {
            console.warn("BatchSimulator: No matches to simulate with current criteria.");
            return null;
        }

        let completedMatches = 0;
        const results = [];

        // 4. Initialize Data Structures
        const factionStats = {};
        const activeFactionsSet = new Set();

        pairs.forEach(p => {
            activeFactionsSet.add(p.f1);
            activeFactionsSet.add(p.f2);
        });

        activeFactionsSet.forEach(fKey => {
            factionStats[fKey] = {
                matches: 0,
                wins: 0,
                winRate: 0,
                totalDuration: 0,
                avgDuration: 0,
                totalPlanetShare: 0,
                avgPlanetShare: 0
            };
        });

        const mapStats = {};
        mapsToTest.forEach(m => {
            mapStats[m.slotNum] = {
                name: m.mapData.name,
                matches: 0,
                totalDuration: 0,
                avgDuration: 0
            };
        });

        // 5. Execution Loop
        for (const mapObj of mapsToTest) {
            for (const pair of pairs) {
                for (let m = 0; m < matchesPerPair; m++) {
                    // Alternate home/away starting positions on odd matches
                    const p1Faction = (m % 2 === 0) ? pair.f1 : pair.f2;
                    const p2Faction = (m % 2 === 0) ? pair.f2 : pair.f1;

                    const matchResult = await this.simulateSingleMatch(registry, mapObj.slotNum, p1Faction, p2Faction);
                    results.push(matchResult);

                    completedMatches++;
                    if (typeof onProgress === 'function') {
                        onProgress(completedMatches, totalMatches);
                    }

                    // Yield to browser main thread briefly every 2 matches so UI updates progress smoothly
                    if (completedMatches % 2 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            }
        }

        // 6. Compile Aggregate Statistics
        results.forEach(res => {
            const duration = res.duration || 0;
            const winner = res.winnerId; // 1 or 2

            const p1Key = res.p1Faction;
            const p2Key = res.p2Faction;

            if (factionStats[p1Key]) {
                factionStats[p1Key].matches++;
                if (winner === 1) factionStats[p1Key].wins++;
                factionStats[p1Key].totalDuration += duration;
                factionStats[p1Key].totalPlanetShare += res.p1PlanetShare || 0;
            }

            if (factionStats[p2Key]) {
                factionStats[p2Key].matches++;
                if (winner === 2) factionStats[p2Key].wins++;
                factionStats[p2Key].totalDuration += duration;
                factionStats[p2Key].totalPlanetShare += res.p2PlanetShare || 0;
            }

            if (mapStats[res.mapSlot]) {
                mapStats[res.mapSlot].matches++;
                mapStats[res.mapSlot].totalDuration += duration;
            }
        });

        // Compute averages and percentages
        Object.keys(factionStats).forEach(fKey => {
            const st = factionStats[fKey];
            if (st.matches > 0) {
                st.winRate = Math.round((st.wins / st.matches) * 100);
                st.avgDuration = Math.round(st.totalDuration / st.matches);
                st.avgPlanetShare = Math.round(st.totalPlanetShare / st.matches);
            }
        });

        Object.keys(mapStats).forEach(mKey => {
            const ms = mapStats[mKey];
            if (ms.matches > 0) {
                ms.avgDuration = Math.round(ms.totalDuration / ms.matches);
            }
        });

        return {
            totalMatches: completedMatches,
            factions: Array.from(activeFactionsSet),
            factionStats,
            mapStats,
            rawResults: results
        };
    }

    /**
     * Runs a single headless simulation to completion without rendering canvas graphics.
     */
    static simulateSingleMatch(registry, mapSlotNum, p1Faction, p2Faction) {
        return new Promise((resolve) => {
            const scaledMap = registry.getScaledMap(mapSlotNum, 1280, 720);
            const simManager = new GameManager();

            // Initialize game state in CPU vs CPU mode
            simManager.start(scaledMap, p1Faction, p2Faction, 'CPU_VS_CPU');

            const fixedDelta = 0.05; // 20 updates/second logic step
            let simTime = 0;
            const maxSimTime = 600; // 10 minute timeout guard

            // Fast Headless Simulation Step Loop
            while (simManager.isRunning && simTime < maxSimTime) {
                simManager.update(fixedDelta);
                simTime += fixedDelta;

                // Determine match end (one team holds all non-neutral planets or target score)
                const planets = simManager.planets || [];
                const p1Planets = planets.filter(p => p.owner === 1).length;
                const p2Planets = planets.filter(p => p.owner === 2).length;

                if (planets.length > 0) {
                    if (p1Planets === planets.length || (p2Planets === 0 && simTime > 15)) {
                        simManager.winnerId = 1;
                        simManager.isRunning = false;
                    } else if (p2Planets === planets.length || (p1Planets === 0 && simTime > 15)) {
                        simManager.winnerId = 2;
                        simManager.isRunning = false;
                    }
                }
            }

            const totalPlanets = simManager.planets ? simManager.planets.length : 1;
            const p1Final = simManager.planets ? simManager.planets.filter(p => p.owner === 1).length : 0;
            const p2Final = simManager.planets ? simManager.planets.filter(p => p.owner === 2).length : 0;

            const result = {
                mapSlot: mapSlotNum,
                p1Faction,
                p2Faction,
                winnerId: simManager.winnerId || (p1Final > p2Final ? 1 : (p2Final > p1Final ? 2 : 0)),
                duration: Math.round(simTime),
                p1PlanetShare: Math.round((p1Final / totalPlanets) * 100),
                p2PlanetShare: Math.round((p2Final / totalPlanets) * 100)
            };

            simManager.stop();
            resolve(result);
        });
    }
}