class AIController {
    constructor(gameManager, teamOwner = 2) {
        this.gameManager = gameManager;
        this.teamOwner = teamOwner;
        this.aiTimer = 0;
    }

    getFactionProfile() {
        const faction = FactionManager.getFaction(this.teamOwner, this.gameManager);

        switch (faction.id) {
            case 'HIVE':
                return {
                    updateInterval: 1.8,       // Rapid decisions
                    fleetThreshold: 3,         // Attacks in small swarm waves
                    dispatchRatio: 0.45,       // Harassing wave sizes
                    upgradePriority: 'low',    // Expansion > Upgrading
                    targetStrategy: 'weakest'  // Picks off weak/unclaimed targets
                };

            case 'GOLIATH':
                return {
                    updateInterval: 3.0,
                    fleetThreshold: 5,        // Dropped from 8 so they expand earlier
                    dispatchRatio: 0.70,
                    upgradePriority: 'medium', // Changed from high so they don't lock up early
                    targetStrategy: 'value'
                };

            case 'PROTOCOL':
                return {
                    updateInterval: 2.2,       // Sharp, responsive decisions
                    fleetThreshold: 5,         // Moderate fleet threshold
                    dispatchRatio: 0.60,       // Focused strike forces
                    upgradePriority: 'medium',
                    targetStrategy: 'player'   // Direct sniper focus on player planets
                };

            case 'SCRAPPER':
                return {
                    updateInterval: 2.0,       // Relentless pressure
                    fleetThreshold: 4,         // Fast, aggressive skirmishes
                    dispatchRatio: 0.50,
                    upgradePriority: 'low',    // Constant territory grabbing
                    targetStrategy: 'nearest'  // Attacks whatever is closest
                };

            case 'ARCHON':
                return {
                    updateInterval: 2.8,
                    fleetThreshold: 5,        // Dropped from 9 so they expand earlier
                    dispatchRatio: 0.65,
                    upgradePriority: 'medium',
                    targetStrategy: 'nearest'
                };

            case 'HUMAN':
            default:
                return {
                    updateInterval: 2.5,       // Balanced baseline
                    fleetThreshold: 5,
                    dispatchRatio: 0.50,
                    upgradePriority: 'medium',
                    targetStrategy: 'nearest'
                };
        }
    }

    selectTarget(source, targets, strategy) {
        if (!targets || targets.length === 0) return null;

        if (strategy === 'weakest') {
            return targets.reduce((best, candidate) => {
                const candidateVal = (candidate.owner === 0 ? 0 : 10) + candidate.hp + candidate.level * 5;
                const bestVal = (best.owner === 0 ? 0 : 10) + best.hp + best.level * 5;
                return candidateVal < bestVal ? candidate : best;
            }, targets[0]);
        }

        if (strategy === 'player') {
            const playerTargets = targets.filter(p => p.owner === 1);
            if (playerTargets.length > 0) {
                return this.getNearestTarget(source, playerTargets);
            }
        }

        if (strategy === 'value') {
            const sortedByLevel = [...targets].sort((a, b) => b.level - a.level);
            return sortedByLevel[0];
        }

        return this.getNearestTarget(source, targets);
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

        if (allEnemyTargets.length === 0) return;

        // Separate unclaimed neutral planets from enemy-controlled planets
        const neutralTargets = allEnemyTargets.filter(p => p.owner === 0);

        ownedPlanets.forEach(source => {
            const orbitingCount = source.getOrbitingShipsCount(this.gameManager.ships);
            const maxTier = source.getMaxTier();
            const reqCost = source.getUpgradeCost();

            // 1. Hold & Upgrade Evaluation
            let isHoldingForUpgrade = false;

            if (source.level < maxTier) {
                const canAfford = (orbitingCount + source.upgradeProgress) >= reqCost;

                if (canAfford) {
                    let shouldUpgrade = false;
                    if (profile.upgradePriority === 'high') {
                        shouldUpgrade = true;
                    } else if (profile.upgradePriority === 'medium') {
                        shouldUpgrade = orbitingCount >= reqCost;
                    } else if (profile.upgradePriority === 'low') {
                        shouldUpgrade = orbitingCount >= reqCost + 4 || neutralTargets.length === 0;
                    }

                    if (shouldUpgrade) {
                        source.startUpgrade(this.gameManager.ships);
                        return; // Finished action for this planet on this update tick
                    }
                } else {
                    // Garrison Hold: Prevent high/medium upgrade factions from burning ships on tiny dispatches while saving up
                    if (profile.upgradePriority === 'high') {
                        isHoldingForUpgrade = true;
                    } else if (profile.upgradePriority === 'medium' && orbitingCount < reqCost) {
                        isHoldingForUpgrade = true;
                    }
                }
            }

            if (isHoldingForUpgrade) return;

            // 2. Fleet Dispatch & Neutral-First Target Selection
            if (orbitingCount >= profile.fleetThreshold) {
                let target = null;

                // Priority 1: Secure nearest unclaimed neutral planets first
                if (neutralTargets.length > 0) {
                    target = this.getNearestTarget(source, neutralTargets);
                } else {
                    // Priority 2: Shift to faction target strategy once all neutrals are claimed
                    target = this.selectTarget(source, allEnemyTargets, profile.targetStrategy);
                }

                if (target) {
                    this.gameManager.dispatchFleet(source, target, profile.dispatchRatio);
                }
            }
        });
    }
}