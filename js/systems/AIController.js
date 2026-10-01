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
            // 1. Upgrade planet if enough orbiting ships are present
            const maxTier = source.getMaxTier();
            if (source.level < maxTier) {
                const reqCost = source.getUpgradeCost();
                if (source.getOrbitingShipsCount(this.gameManager.ships) + source.upgradeProgress >= reqCost) {
                    source.startUpgrade(this.gameManager.ships); // FIX: match method name in Planet.js
                    return;
                }
            }

            // 2. Dispatch fleet to nearest non-owned target
            if (source.getOrbitingShipsCount(this.gameManager.ships) >= 6) {
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