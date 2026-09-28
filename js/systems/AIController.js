class AIController {
    constructor(gameManager, teamOwner = 2) {
        this.gameManager = gameManager;
        this.teamOwner = teamOwner;
        this.aiTimer = 0;
    }

    update(dt) {
        this.aiTimer += dt;
        if (this.aiTimer < 3.0) return;
        
        this.aiTimer = 0;
        const ownedPlanets = this.gameManager.planets.filter(p => p.owner === this.teamOwner);
        
        ownedPlanets.forEach(source => {
            if (source.level < 3) {
                const reqCost = TIER_STATS[source.level].upgradeCost;
                if (source.getOrbitingShipsCount(this.gameManager.ships) + source.upgradeProgress >= reqCost) {
                    source.startLanding(this.gameManager.ships);
                    return;
                }
            }

            if (source.getOrbitingShipsCount(this.gameManager.ships) >= 6 && !source.isLanding) {
                const targets = this.gameManager.planets.filter(p => p.owner !== this.teamOwner);
                if (targets.length > 0) {
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

                    this.gameManager.dispatchFleet(source, target, 0.5);
                }
            }
        });
    }
}