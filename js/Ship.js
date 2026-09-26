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
        this.enginePower = 55;

        this.state = sourcePlanet === targetPlanet ? 'orbit' : 'moving';

        this.orbitAngle = spawnAngle;
        
        // --- ORBIT HEIGHT CONFIGURATION ---
        // Min height above surface: 10px | Max height above surface: 10 + 22 = 32px
        // Adjust these two numbers to change orbit distances across all planets!
        const minOrbitOffset = 8;
        const maxOrbitSpread = 18; // Reduced slightly for tighter, cleaner orbits
        this.targetOrbitRadius = sourcePlanet.radius + minOrbitOffset + Math.random() * maxOrbitSpread;
        this.currentOrbitRadius = this.targetOrbitRadius;

        this.initialLandingRadius = null;
        this.landingProgress = null;
        this.landingDuration = 3.8; // Extended slightly for softer touchdown

        this.isIntercepting = false;
        this.isReturningToOrbit = false;

        this.orbitSpeed = (2.2 + Math.random() * 0.5) / Math.sqrt(this.targetOrbitRadius);
        this.dead = false;

        this.thrusterState = 'none';

        this.targetDx = targetPlanet.x - this.x;
        this.targetDy = targetPlanet.y - this.y;
        this.targetDist = Math.sqrt(this.targetDx * this.targetDx + this.targetDy * this.targetDy);
    }

    abortLanding() {
        if (this.state === 'landing') {
            this.state = 'orbit';
            this.isReturningToOrbit = true;
            this.landingProgress = null;
            this.initialLandingRadius = null;
        }
    }

    getBoidForces() {
        let sepX = 0, sepY = 0;
        let alignX = 0, alignY = 0;
        let cohortX = 0, cohortY = 0;
        let neighborCount = 0;

        const neighborDist = 28;
        const sepDist = 10;

        for (let i = 0; i < ships.length; i++) {
            const other = ships[i];
            if (other !== this && !other.dead && other.owner === this.owner && other.state === 'moving' && other.targetPlanet === this.targetPlanet) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 0 && distSq < neighborDist * neighborDist) {
                    const dist = Math.sqrt(distSq);

                    if (dist < sepDist) {
                        const force = (sepDist - dist) / sepDist;
                        sepX -= (dx / dist) * force;
                        sepY -= (dy / dist) * force;
                    }

                    alignX += other.vx;
                    alignY += other.vy;

                    cohortX += other.x;
                    cohortY += other.y;

                    neighborCount++;
                }
            }
        }

        let forceX = sepX * 12;
        let forceY = sepY * 12;

        if (neighborCount > 0) {
            alignX /= neighborCount;
            alignY /= neighborCount;
            forceX += (alignX - this.vx) * 0.8;
            forceY += (alignY - this.vy) * 0.8;

            cohortX /= neighborCount;
            cohortY /= neighborCount;
            forceX += (cohortX - this.x) * 0.4;
            forceY += (cohortY - this.y) * 0.4;
        }

        return { x: forceX, y: forceY };
    }

    update(dt) {
        if (this.dead) return;

        // LANDING & UPGRADE MODE
        if (this.state === 'landing') {
            this.thrusterState = 'retro';

            if (this.landingProgress === null) {
                this.landingProgress = 0;
                const dx = this.x - this.targetPlanet.x;
                const dy = this.y - this.targetPlanet.y;
                this.initialLandingRadius = Math.sqrt(dx * dx + dy * dy);
                this.orbitAngle = Math.atan2(dy, dx);
            }

            this.landingProgress += dt / this.landingDuration;
            const p = Math.min(1, Math.max(0, this.landingProgress));

            // Smooth cubic ease-out curve for altitude (decelerates heavily on touchdown)
            const altFactor = Math.pow(1 - p, 2);
            const targetRadius = this.targetPlanet.radius + 1.5;
            const radiusDelta = this.initialLandingRadius - targetRadius;
            this.currentOrbitRadius = targetRadius + radiusDelta * altFactor;

            const omegaFactor = Math.pow(1 - p, 1.2);
            const currentAngularSpeed = this.orbitSpeed * omegaFactor;
            this.orbitAngle += currentAngularSpeed * dt;

            this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
            this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

            const dAlt_dt = -2 * (1 - p) * (radiusDelta / this.landingDuration);
            const dtheta_dt = currentAngularSpeed;

            const cosA = Math.cos(this.orbitAngle);
            const sinA = Math.sin(this.orbitAngle);

            this.vx = dAlt_dt * cosA - this.currentOrbitRadius * dtheta_dt * sinA;
            this.vy = dAlt_dt * sinA + this.currentOrbitRadius * dtheta_dt * cosA;

            if (p >= 1.0) {
                this.landingProgress = null;
                this.initialLandingRadius = null;
                destroyShip(this);
                this.targetPlanet.upgradeProgress++;
                const reqCost = TIER_STATS[this.targetPlanet.level].upgradeCost;
                if (this.targetPlanet.upgradeProgress >= reqCost) {
                    this.targetPlanet.upgrade();
                }
            }
            return;
        }

        // ORBIT & DEFENSE MODE
        if (this.state === 'orbit') {
            this.landingProgress = null;
            this.initialLandingRadius = null;

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
                this.isIntercepting = true;
                this.isReturningToOrbit = false;

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
                if (this.isIntercepting) {
                    this.isIntercepting = false;
                    this.isReturningToOrbit = true;
                    const dxPlanet = this.x - this.targetPlanet.x;
                    const dyPlanet = this.y - this.targetPlanet.y;
                    this.currentOrbitRadius = Math.sqrt(dxPlanet * dxPlanet + dyPlanet * dyPlanet);
                    this.orbitAngle = Math.atan2(dyPlanet, dxPlanet);
                }

                const radiusDiff = this.targetOrbitRadius - this.currentOrbitRadius;

                if (this.isReturningToOrbit || Math.abs(radiusDiff) > 0.8) {
                    this.thrusterState = 'main';

                    const speedCap = 14;
                    const radialVelocity = Math.min(Math.abs(radiusDiff) * 3.0, speedCap);
                    const radialStep = radialVelocity * dt;

                    if (Math.abs(radiusDiff) <= Math.max(0.5, radialStep)) {
                        this.currentOrbitRadius = this.targetOrbitRadius;
                        this.isReturningToOrbit = false;
                    } else {
                        this.currentOrbitRadius += Math.sign(radiusDiff) * radialStep;
                    }

                    this.orbitAngle += this.orbitSpeed * dt;

                    const nextX = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                    const nextY = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

                    this.vx = (nextX - this.x) / dt;
                    this.vy = (nextY - this.y) / dt;

                    this.x = nextX;
                    this.y = nextY;
                } else {
                    this.isReturningToOrbit = false;
                    this.thrusterState = 'none';
                    this.orbitAngle += this.orbitSpeed * dt;
                    this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                    this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;
                }
            }
            return;
        }

        // INTERPLANETARY TRANSIT MODE
        if (this.state === 'moving') {
            this.landingProgress = null;
            this.initialLandingRadius = null;
            this.isIntercepting = false;
            this.isReturningToOrbit = false;

            // 1. Intercept enemy check
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
                    return;
                }
            }

            // 2. Dynamic Target Check
            this.targetDx = this.targetPlanet.x - this.x;
            this.targetDy = this.targetPlanet.y - this.y;
            this.targetDist = Math.sqrt(this.targetDx * this.targetDx + this.targetDy * this.targetDy);

            const isFriendly = (this.targetPlanet.owner === this.owner);
            const isLandingTarget = isFriendly && this.targetPlanet.isLanding;

            // Target arrival thresholds
            if (isFriendly) {
                if (isLandingTarget && this.targetDist <= this.targetOrbitRadius) {
                    this.state = 'landing';
                    return;
                } else if (!isLandingTarget && this.targetDist <= this.targetOrbitRadius + 2) {
                    this.state = 'orbit';
                    this.orbitAngle = Math.atan2(this.y - this.targetPlanet.y, this.x - this.targetPlanet.x);
                    this.currentOrbitRadius = this.targetDist;
                    return;
                }
            } else {
                const impactDist = this.targetPlanet.radius + 3;
                if (this.targetDist <= impactDist) {
                    handlePlanetImpact(this);
                    return;
                }
            }

            // 3. Arrival Steering Physics
            const targetThreshold = isFriendly ? this.targetOrbitRadius : this.targetPlanet.radius;
            const distToThreshold = Math.max(0, this.targetDist - targetThreshold);

            const slowingRadius = 40;
            let desiredSpeed = this.maxSpeed;

            if (distToThreshold < slowingRadius) {
                const ramp = distToThreshold / slowingRadius;
                // Floor reduced to 6px/s so ships ease down smoothly right at touchdown
                desiredSpeed = Math.max(6, this.maxSpeed * Math.pow(ramp, 1.1));
            }

            let desiredVx = (this.targetDx / this.targetDist) * desiredSpeed;
            let desiredVy = (this.targetDy / this.targetDist) * desiredSpeed;

            // Apply Boid Flocking Force
            const boid = this.getBoidForces();
            desiredVx += boid.x;
            desiredVy += boid.y;

            const steeringX = desiredVx - this.vx;
            const steeringY = desiredVy - this.vy;

            let ax = steeringX * 6;
            let ay = steeringY * 6;

            const accelMag = Math.sqrt(ax * ax + ay * ay);
            if (accelMag > this.enginePower) {
                ax = (ax / accelMag) * this.enginePower;
                ay = (ay / accelMag) * this.enginePower;
            }

            // Determine Thruster Visual State
            const dotProduct = ax * this.vx + ay * this.vy;
            if (distToThreshold < slowingRadius) {
                this.thrusterState = 'retro';
            } else if (accelMag < 12) {
                this.thrusterState = 'none';
            } else if (dotProduct < -15) {
                this.thrusterState = 'retro';
            } else {
                this.thrusterState = 'main';
            }

            this.vx += ax * dt;
            this.vy += ay * dt;

            this.x += this.vx * dt;
            this.y += this.vy * dt;
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

        if (this.thrusterState === 'main') {
            ctx.fillStyle = '#ffaa11';
            const plumeX = this.x - Math.cos(moveAngle) * 4;
            const plumeY = this.y - Math.sin(moveAngle) * 4;
            ctx.beginPath();
            ctx.arc(plumeX, plumeY, 1.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.thrusterState === 'retro') {
            ctx.fillStyle = '#ff6600';
            const retroX = this.x + Math.cos(moveAngle) * 3;
            const retroY = this.y + Math.sin(moveAngle) * 3;
            ctx.beginPath();
            ctx.arc(retroX, retroY, 1.0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}