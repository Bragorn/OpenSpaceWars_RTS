class AIController {
    constructor(gameManager, teamOwner = 2) {
        this.gameManager = gameManager;
        this.teamOwner = teamOwner;
        this.aiTimer = 0;
    }

    getFactionProfile() {
        // Universal baseline profiles for testing
        return {
            updateInterval: 2.0,
            safetyMargin: 1.1,      // Requires 10% force advantage to attack occupied bases
            dispatchRatio: 0.60,     // Dispatches 60% of orbiting fleet on attack
            upgradeRatioThreshold: 0.8 // Saves for upgrade if near capacity
        };
    }

    /**
     * Calculates total HP/Combat Value of ships orbiting a planet for a specific owner.
     */
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

        if (allEnemyTargets.length === 0) return;

        const neutralTargets = allEnemyTargets.filter(p => p.owner === 0);
        const myFaction = FactionManager.getFaction(this.teamOwner, this.gameManager);
        const shipHp = myFaction.hp || 20;

        ownedPlanets.forEach(source => {
            const orbitingCount = source.getOrbitingShipsCount(this.gameManager.ships);
            if (orbitingCount === 0) return;

            const myPower = orbitingCount * shipHp;
            const maxTier = source.getMaxTier();
            const reqCost = source.getUpgradeCost();

            // 1. Check for Planet Upgrades First
            if (source.level < maxTier) {
                if (orbitingCount >= reqCost) {
                    source.startUpgrade(this.gameManager.ships);
                    return;
                }
            }

            // 2. Target Neutral Planets First (Low Defenses)
            if (neutralTargets.length > 0) {
                const target = this.getNearestTarget(source, neutralTargets);
                const targetDefensePower = target.hp; // Neutrals have 0 defending ships

                // Dispatch if we have enough force to capture the neutral planet
                if (myPower > targetDefensePower) {
                    this.gameManager.dispatchFleet(source, target, profile.dispatchRatio);
                    return;
                }
            }

            // 3. Attack Enemy Planets (Requires Force Advantage)
            if (allEnemyTargets.length > 0) {
                const target = this.getNearestTarget(source, allEnemyTargets);
                const enemyFaction = FactionManager.getFaction(target.owner, this.gameManager);
                const enemyDefendingPower = this.calculateFleetPower(target, target.owner);
                const totalTargetPower = target.hp + enemyDefendingPower;

                // Force Evaluation: Only attack if Attacking Power > (Target Power * Safety Margin)
                if (myPower >= totalTargetPower * profile.safetyMargin) {
                    this.gameManager.dispatchFleet(source, target, profile.dispatchRatio);
                }
            }
        });
    }
}