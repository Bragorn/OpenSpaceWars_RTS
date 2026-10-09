class AIController {
    constructor(gameManager, teamOwner = 2) {
        this.gameManager = gameManager;
        this.teamOwner = teamOwner;
        this.aiTimer = 0;
        this.currentState = 'HOLDING_RESERVES';
    }

    getFactionProfile() {
        return {
            updateInterval: 1.5,
            safetyMargin: 1.15,
            dispatchRatio: 0.60
        };
    }

    getGlobalSpawnRate(ownerId) {
        if (!this.gameManager || !this.gameManager.planets) return 0.01;
        const owned = this.gameManager.planets.filter(p => p.owner === ownerId);
        let totalSpawnsPerSec = 0;

        owned.forEach(p => {
            const faction = FactionManager.getFaction(ownerId, this.gameManager);
            const stats = p.tierStats ? p.tierStats[p.level] : { spawnInterval: 3.0 };
            const actualInterval = stats.spawnInterval * (faction.spawnIntervalMult || 1.0);
            if (actualInterval > 0) totalSpawnsPerSec += (1.0 / actualInterval);
        });

        return Math.max(0.01, totalSpawnsPerSec);
    }

    calculateFleetPower(planet, ownerId) {
        if (!this.gameManager || !this.gameManager.ships) return 0;
        const faction = FactionManager.getFaction(ownerId, this.gameManager);
        const shipHp = faction.hp || 20;

        let count = 0;
        this.gameManager.ships.forEach(s => {
            if (s.owner === ownerId && s.orbitPlanet === planet && s.state === 'ORBIT') {
                count++;
            }
        });

        return count * shipHp;
    }

    getIncomingShipsCount(targetPlanet) {
        if (!this.gameManager || !this.gameManager.ships) return 0;
        return this.gameManager.ships.filter(s => 
            s && !s.dead && s.owner === this.teamOwner && s.targetPlanet === targetPlanet && s.state !== 'ORBIT'
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

        const profile = this.getFactionProfile();

        this.aiTimer += dt;
        if (this.aiTimer < profile.updateInterval) return;
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

        const myFaction = FactionManager.getFaction(this.teamOwner, this.gameManager);
        const shipHp = myFaction.hp || 20;

        let actionTaken = false;

        ownedPlanets.forEach(source => {
            const orbitingCount = source.getOrbitingShipsCount(this.gameManager.ships);
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
                    const claimCost = n.claimCost || 5;
                    const inTransit = this.getIncomingShipsCount(n);
                    return inTransit < claimCost;
                });

                if (availableNeutrals.length > 0) {
                    const target = this.getNearestTarget(source, availableNeutrals);
                    if (target && myPower > target.hp) {
                        this.gameManager.dispatchFleet(source, target, profile.dispatchRatio);
                        this.currentState = 'EXPANDING_NEUTRAL';
                        actionTaken = true;
                        if (this.gameManager.telemetry) {
                            this.gameManager.telemetry.logEvent(this.gameManager.gameTime, 'DISPATCH', this.teamOwner, { ratio: profile.dispatchRatio });
                        }
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

                if (myPower >= totalTargetPower * profile.safetyMargin) {
                    this.gameManager.dispatchFleet(source, target, profile.dispatchRatio);
                    this.currentState = 'ASSAULTING_ENEMY';
                    actionTaken = true;
                    if (this.gameManager.telemetry) {
                        this.gameManager.telemetry.logEvent(this.gameManager.gameTime, 'DISPATCH', this.teamOwner, { ratio: profile.dispatchRatio });
                    }
                }
            }
        });

        if (!actionTaken) {
            this.currentState = 'BUILDING_RESERVES';
        }
    }
}