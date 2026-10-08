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
            safetyMargin: 1.1,
            dispatchRatio: 0.60,
            upgradeRatioThreshold: 0.8
        };
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

    getNearestTarget(source, targets) {
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
            if (source.level < maxTier) {
                if (orbitingCount >= reqCost) {
                    source.startUpgrade(this.gameManager.ships);
                    this.currentState = `UPGRADING_PLANET_${source.level + 1}`;
                    actionTaken = true;
                    return;
                }
            }

            // 2. Neutral Expansion
            if (neutralTargets.length > 0) {
                const target = this.getNearestTarget(source, neutralTargets);
                if (myPower > target.hp) {
                    this.gameManager.dispatchFleet(source, target, profile.dispatchRatio);
                    this.currentState = 'EXPANDING_NEUTRAL';
                    actionTaken = true;
                    if (this.gameManager.telemetry) {
                        this.gameManager.telemetry.logEvent(this.gameManager.gameTime, 'DISPATCH', this.teamOwner, { ratio: profile.dispatchRatio });
                    }
                    return;
                }
            }

            // 3. Enemy Assault
            if (allEnemyTargets.length > 0) {
                const target = this.getNearestTarget(source, allEnemyTargets);
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