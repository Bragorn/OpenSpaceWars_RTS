class Unit {
    constructor(sourcePlanet, targetPlanet) {
        this.owner = sourcePlanet.owner;
        this.targetPlanet = targetPlanet;
        
        // Spawn slightly randomized around source planet
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnOffset = sourcePlanet.radius + 4 + Math.random() * 8;
        this.x = sourcePlanet.x + Math.cos(spawnAngle) * spawnOffset;
        this.y = sourcePlanet.y + Math.sin(spawnAngle) * spawnOffset;
        
        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = 35;
        this.enginePower = 120; // Acceleration force
        
        this.state = sourcePlanet === targetPlanet ? 'orbit' : 'moving';
        
        // Dynamic Orbit parameters
        this.orbitAngle = spawnAngle;
        this.targetOrbitRadius = sourcePlanet.radius + 10 + Math.random() * 22; // Varied altitude bands
        this.currentOrbitRadius = this.targetOrbitRadius;
        
        // Keplerian Orbit Speed: Faster inner orbits, slower outer orbits
        this.orbitSpeed = (14.0 + Math.random() * 2.0) / Math.sqrt(this.targetOrbitRadius);
        
        this.dead = false;
    }

    update(dt) {
        if (this.dead) return;

        // --- STATE 1: DOCKING (Landing on Planet for Upgrades) ---
        if (this.state === 'docking') {
            const dx = this.targetPlanet.x - this.x;
            const dy = this.targetPlanet.y - this.y;
            const distSq = dx * dx + dy * dy;

            // Touchdown check at planet surface
            if (distSq <= (this.targetPlanet.radius + 2) * (this.targetPlanet.radius + 2)) {
                destroyUnit(this);
                this.targetPlanet.upgradeProgress++;
                
                const reqCost = TIER_STATS[this.targetPlanet.level].upgradeCost;
                if (this.targetPlanet.upgradeProgress >= reqCost) {
                    this.targetPlanet.upgrade();
                }
                return;
            }

            // Direct engine thrust straight down to planet surface
            const dist = Math.sqrt(distSq);
            const dockSpeed = this.maxSpeed * 1.2;
            this.x += (dx / dist) * dockSpeed * dt;
            this.y += (dy / dist) * dockSpeed * dt;
            return;
        }

        // --- STATE 2: ORBIT & LOCAL DEFENSE ---
        if (this.state === 'orbit') {
            // Expand gently to target orbit radius if needed
            if (this.currentOrbitRadius < this.targetOrbitRadius) {
                this.currentOrbitRadius = Math.min(this.targetOrbitRadius, this.currentOrbitRadius + 18 * dt);
            }

            let targetEnemy = null;
            let minEnemyDistSq = 3600; // Defense radius (~60px)

            for (let i = 0; i < units.length; i++) {
                const other = units[i];
                if (other !== this && !other.dead && other.owner !== this.owner) {
                    const dxPlanet = other.x - this.targetPlanet.x;
                    const dyPlanet = other.y - this.targetPlanet.y;
                    if (dxPlanet * dxPlanet + dyPlanet * dyPlanet < minEnemyDistSq) {
                        const dx = other.x - this.x;
                        const dy = other.y - this.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < minEnemyDistSq) {
                            minEnemyDistSq = distSq;
                            targetEnemy = other;
                        }
                    }
                }
            }

            // Intercept enemy craft
            if (targetEnemy) {
                const dx = targetEnemy.x - this.x;
                const dy = targetEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 25) {
                    destroyUnit(this);
                    destroyUnit(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.x += (dx / dist) * (this.maxSpeed * 1.3) * dt;
                    this.y += (dy / dist) * (this.maxSpeed * 1.3) * dt;
                }
            } else {
                // Keplerian circular orbit math around home planet
                this.orbitAngle += this.orbitSpeed * dt;
                this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;
            }
            return;
        }

        // --- STATE 3: MOVING (Interplanetary Flight) ---
        if (this.state === 'moving') {
            let targetEnemy = null;
            let minEnemyDistSq = 900;

            for (let i = 0; i < units.length; i++) {
                const other = units[i];
                if (other !== this && !other.dead && other.owner !== this.owner) {
                    const dx = other.x - this.x;
                    const dy = other.y - this.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minEnemyDistSq) {
                        minEnemyDistSq = distSq;
                        targetEnemy = other;
                    }
                }
            }

            // In-flight interception
            if (targetEnemy) {
                const dx = targetEnemy.x - this.x;
                const dy = targetEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 25) {
                    destroyUnit(this);
                    destroyUnit(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.x += (dx / dist) * this.maxSpeed * dt;
                    this.y += (dy / dist) * this.maxSpeed * dt;
                }
            } else {
                // Vector Thrust + Mild Central Solar Gravity for Curved Trajectories
                const targetDx = this.targetPlanet.x - this.x;
                const targetDy = this.targetPlanet.y - this.y;
                const targetDistSq = targetDx * targetDx + targetDy * targetDy;
                const impactDist = this.targetPlanet.radius + 4;

                if (targetDistSq < impactDist * impactDist) {
                    handlePlanetImpact(this);
                } else {
                    const targetDist = Math.sqrt(targetDistSq);
                    
                    // Main Engine Thrust toward target planet
                    let ax = (targetDx / targetDist) * this.enginePower;
                    let ay = (targetDy / targetDist) * this.enginePower;

                    // Slight Solar Gravity Pull toward system center (creates natural arc)
                    const sunX = arenaSize / 2;
                    const sunY = arenaSize / 2;
                    const sunDx = sunX - this.x;
                    const sunDy = sunY - this.y;
                    const sunDistSq = sunDx * sunDx + sunDy * sunDy;
                    
                    if (sunDistSq > 100) {
                        const sunDist = Math.sqrt(sunDistSq);
                        const gravityStrength = 30; // Subtle gravity curve
                        ax += (sunDx / sunDist) * gravityStrength;
                        ay += (sunDy / sunDist) * gravityStrength;
                    }

                    // Integration step with max velocity cap
                    this.vx += ax * dt;
                    this.vy += ay * dt;

                    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                    if (speed > this.maxSpeed) {
                        this.vx = (this.vx / speed) * this.maxSpeed;
                        this.vy = (this.vy / speed) * this.maxSpeed;
                    }

                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                }
            }
        }
    }

    // Add path to current canvas context without drawing yet
    path() {
        if (this.dead) return;
        ctx.moveTo(this.x + 2, this.y);
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    }
}