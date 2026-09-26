class Ship {
    constructor(sourcePlanet, targetPlanet) {
        this.owner = sourcePlanet.owner;
        this.targetPlanet = targetPlanet;

        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnOffset = sourcePlanet.radius + 4 + Math.random() * 8;
        this.x = sourcePlanet.x + Math.cos(spawnAngle) * spawnOffset;
        this.y = sourcePlanet.y + Math.sin(spawnAngle) * spawnOffset;

        this.startX = this.x;
        this.startY = this.y;

        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = 35;
        this.enginePower = 120;

        this.state = sourcePlanet === targetPlanet ? 'orbit' : 'moving';

        this.orbitAngle = spawnAngle;
        this.targetOrbitRadius = sourcePlanet.radius + 10 + Math.random() * 22;
        this.currentOrbitRadius = this.targetOrbitRadius;

        this.orbitSpeed = (2.2 + Math.random() * 0.5) / Math.sqrt(this.targetOrbitRadius);
        this.dead = false;

        this.thrusterState = 'none';
    }

    update(dt) {
        if (this.dead) return;

        // LANDING & UPGRADE MODE
        if (this.state === 'landing') {
            this.thrusterState = 'main';
            const dx = this.targetPlanet.x - this.x;
            const dy = this.targetPlanet.y - this.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= (this.targetPlanet.radius + 2) ** 2) {
                destroyShip(this);
                this.targetPlanet.upgradeProgress++;
                const reqCost = TIER_STATS[this.targetPlanet.level].upgradeCost;
                if (this.targetPlanet.upgradeProgress >= reqCost) {
                    this.targetPlanet.upgrade();
                }
                return;
            }

            const dist = Math.sqrt(distSq);
            const landingSpeed = this.maxSpeed * 1.2;
            this.vx = (dx / dist) * landingSpeed;
            this.vy = (dy / dist) * landingSpeed;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            return;
        }

        // ORBIT & DEFENSE MODE
        if (this.state === 'orbit') {
            this.thrusterState = 'none';
            if (this.currentOrbitRadius < this.targetOrbitRadius) {
                this.currentOrbitRadius = Math.min(this.targetOrbitRadius, this.currentOrbitRadius + 18 * dt);
            }

            let targetEnemy = null;
            let minEnemyDistSq = 3600;

            for (let i = 0; i < ships.length; i++) {
                const other = ships[i];
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

            if (targetEnemy) {
                const dx = targetEnemy.x - this.x;
                const dy = targetEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 25) {
                    destroyShip(this);
                    destroyShip(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.vx = (dx / dist) * (this.maxSpeed * 1.3);
                    this.vy = (dy / dist) * (this.maxSpeed * 1.3);
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.thrusterState = 'main';
                }
            } else {
                this.orbitAngle += this.orbitSpeed * dt;
                this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;
            }
            return;
        }

        // INTERPLANETARY TRANSIT MODE
        if (this.state === 'moving') {
            let targetEnemy = null;
            let minEnemyDistSq = 900;

            for (let i = 0; i < ships.length; i++) {
                const other = ships[i];
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

            if (targetEnemy) {
                const dx = targetEnemy.x - this.x;
                const dy = targetEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 25) {
                    destroyShip(this);
                    destroyShip(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.vx = (dx / dist) * this.maxSpeed;
                    this.vy = (dy / dist) * this.maxSpeed;
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.thrusterState = 'main';
                }
            } else {
                const targetDx = this.targetPlanet.x - this.x;
                const targetDy = this.targetPlanet.y - this.y;
                const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);

                // Check if target planet is friendly and NOT requesting surface landing
                const isFriendlyOrbitTarget = (this.targetPlanet.owner === this.owner) && !this.targetPlanet.isLanding;

                if (isFriendlyOrbitTarget && targetDist <= this.targetOrbitRadius) {
                    // Smoothly catch into orbit at exact entry angle & distance
                    this.state = 'orbit';
                    this.orbitAngle = Math.atan2(this.y - this.targetPlanet.y, this.x - this.targetPlanet.x);
                    this.currentOrbitRadius = targetDist;
                    return;
                }

                // If attacking enemy, capturing neutral, or landing to upgrade
                const impactDist = this.targetPlanet.radius + 4;
                if (targetDist <= impactDist) {
                    handlePlanetImpact(this);
                    return;
                }

                // Flight physics
                let ax = (targetDx / targetDist) * this.enginePower;
                let ay = (targetDy / targetDist) * this.enginePower;

                this.vx += ax * dt;
                this.vy += ay * dt;

                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (speed > this.maxSpeed) {
                    this.vx = (this.vx / speed) * this.maxSpeed;
                    this.vy = (this.vy / speed) * this.maxSpeed;
                }

                this.x += this.vx * dt;
                this.y += this.vy * dt;

                // Thruster burn calculations
                const dxFromStart = this.x - this.startX;
                const dyFromStart = this.y - this.startY;
                const distFromStart = Math.sqrt(dxFromStart * dxFromStart + dyFromStart * dyFromStart);
                const burnDistance = 45;

                if (distFromStart < burnDistance) {
                    this.thrusterState = 'main';
                } else if (targetDist < burnDistance + this.targetPlanet.radius) {
                    this.thrusterState = 'retro';
                } else {
                    this.thrusterState = 'none';
                }
            }
        }
    }

    path() {
        if (this.dead) return;
        ctx.moveTo(this.x + 2, this.y);
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    }

    drawThrusters() {
        if (this.dead || this.thrusterState === 'none') return;

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed < 0.1) return;

        const moveAngle = Math.atan2(this.vy, this.vx);

        ctx.save();
        ctx.fillStyle = '#ffaa11';

        if (this.thrusterState === 'main') {
            const plumeX = this.x - Math.cos(moveAngle) * 4;
            const plumeY = this.y - Math.sin(moveAngle) * 4;
            ctx.beginPath();
            ctx.arc(plumeX, plumeY, 1.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.thrusterState === 'retro') {
            const retroX = this.x + Math.cos(moveAngle) * 3;
            const retroY = this.y + Math.sin(moveAngle) * 3;
            ctx.fillStyle = '#44ccff';
            ctx.beginPath();
            ctx.arc(retroX, retroY, 1.0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}