class AIController {
    constructor(gameManager, teamOwner = 2) {
        this.gameManager = gameManager;
        this.teamOwner = teamOwner;
        this.aiTimer = 0;
        this.currentState = 'HOLDING_RESERVES';
    }

    // Sends a fleet and records the dispatch size for telemetry
    dispatch(source, target, ratio) {
        this.gameManager.dispatchFleet(source, target, ratio);
        this.gameManager.telemetry?.logEvent(this.gameManager.gameTime, 'DISPATCH', this.teamOwner, { ratio });
    }

    getGlobalSpawnRate(ownerId) {
        if (!this.gameManager || !this.gameManager.planets) return 0.01;
        const owned = this.gameManager.planets.filter(p => p.owner === ownerId);
        let totalSpawnsPerSec = 0;

        const faction = FactionManager.getFaction(ownerId, this.gameManager);
        owned.forEach(p => {
            const actualInterval = p.statsFor(p.level).spawnInterval * faction.spawnIntervalMult;
            if (actualInterval > 0) totalSpawnsPerSec += (1.0 / actualInterval);
        });

        return Math.max(0.01, totalSpawnsPerSec);
    }

    calculateFleetPower(planet, ownerId) {
        if (!this.gameManager || !this.gameManager.ships) return 0;
        const faction = FactionManager.getFaction(ownerId, this.gameManager);
        const shipHp = faction.hp;

        let count = 0;
        this.gameManager.ships.forEach(s => {
            if (s && !s.dead && s.owner === ownerId && s.orbitPlanet === planet && s.state === 'orbit') {
                count++;
            }
        });

        return count * shipHp;
    }

    getIncomingShipsCount(targetPlanet) {
        if (!this.gameManager || !this.gameManager.ships) return 0;
        return this.gameManager.ships.filter(s =>
            s && !s.dead && s.owner === this.teamOwner && s.targetPlanet === targetPlanet
        ).length;
    }

    getNearestTarget(source, targets) {
        if (!targets || targets.length === 0) return null;
        let target = targets[0];
        let minDistSq = Infinity;
        targets.forEach(t => {
            const dx = t.x - source.x;
            const dy = t.y - source.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                target = t;
            }
        });
        return target;
    }

    update(dt) {
        if (!this.gameManager || !this.gameManager.planets) return;

        const profile = FactionManager.getFaction(this.teamOwner, this.gameManager);

        this.aiTimer += dt;
        if (this.aiTimer < profile.aiUpdateInterval) return;
        this.aiTimer = 0;

        const ownedPlanets = this.gameManager.planets.filter(p => p.owner === this.teamOwner);
        const allEnemyTargets = this.gameManager.planets.filter(p => p.owner !== this.teamOwner);

        if (ownedPlanets.length > 1 && this.gameManager.telemetry) {
            this.gameManager.telemetry.logEvent(this.gameManager.gameTime, 'EXPANSION', this.teamOwner, { planetCount: ownedPlanets.length });
        }

        if (allEnemyTargets.length === 0) {
            this.currentState = 'SYSTEM_SECURED';
            return;
        }

        const neutralTargets = allEnemyTargets.filter(p => p.owner === 0);
        const activeEnemyBases = allEnemyTargets.filter(p => p.owner !== 0);
        const enemyOwner = activeEnemyBases.length > 0 ? activeEnemyBases[0].owner : 0;

        const mySpawnRate = this.getGlobalSpawnRate(this.teamOwner);
        const enemySpawnRate = enemyOwner !== 0 ? this.getGlobalSpawnRate(enemyOwner) : 0.01;
        const prodRatio = mySpawnRate / enemySpawnRate;
        const isBehindEconomically = prodRatio < 0.85;

        const shipHp = profile.hp;

        let actionTaken = false;

        ownedPlanets.forEach(source => {
            const orbitingCount = source.getOrbitingShipsCount(this.gameManager);
            if (orbitingCount === 0) return;

            const myPower = orbitingCount * shipHp;
            const maxTier = source.getMaxTier();
            const reqCost = source.getUpgradeCost();

            // 1. Upgrade Decision
            if (source.level < maxTier && orbitingCount >= reqCost) {
                source.startUpgrade(this.gameManager.ships);
                this.currentState = `UPGRADING_PLANET_${source.level + 1}`;
                actionTaken = true;
                return;
            }

            // 2. Neutral Expansion
            if (neutralTargets.length > 0) {
                const availableNeutrals = neutralTargets.filter(n => {
                    const claimCost = n.claimCost;
                    const inTransit = this.getIncomingShipsCount(n);
                    return inTransit < claimCost;
                });

                if (availableNeutrals.length > 0) {
                    const target = this.getNearestTarget(source, availableNeutrals);
                    if (target && myPower > target.hp) {
                        this.dispatch(source, target, profile.aiDispatchRatio);
                        this.currentState = 'EXPANDING_NEUTRAL';
                        actionTaken = true;
                        return;
                    }
                }
            }

            // 3. Economic Catch-Up Gate
            if (isBehindEconomically && source.level < maxTier && orbitingCount < reqCost) {
                this.currentState = 'SAVING_TO_CLOSE_SPAWN_GAP';
                actionTaken = true;
                return;
            }

            // 4. Enemy Assault
            if (activeEnemyBases.length > 0) {
                const target = this.getNearestTarget(source, activeEnemyBases);
                const enemyDefendingPower = this.calculateFleetPower(target, target.owner);
                const totalTargetPower = target.hp + enemyDefendingPower;

                if (myPower >= totalTargetPower * profile.aiSafetyMargin) {
                    this.dispatch(source, target, profile.aiDispatchRatio);
                    this.currentState = 'ASSAULTING_ENEMY';
                    actionTaken = true;
                }
            }
        });

        if (!actionTaken) {
            this.currentState = 'BUILDING_RESERVES';
        }
    }
}