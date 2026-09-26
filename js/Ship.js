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

        this.initialLandingRadius = null;
        this.landingProgress = null;
        this.landingDuration = 3.6;

        this.orbitSpeed = (2.2 + Math.random() * 0.5) / Math.sqrt(this.targetOrbitRadius);
        this.dead = false;

        this.thrusterState = 'none';

        this.targetDx = targetPlanet.x - this.x;
        this.targetDy = targetPlanet.y - this.y;
        this.targetDist = Math.sqrt(this.targetDx * this.targetDx + this.targetDy * this.targetDy);
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

            const altFactor = 0.5 * (1 + Math.cos(Math.PI * p * p));
            const targetRadius = this.targetPlanet.radius + 2;
            const radiusDelta = this.initialLandingRadius - targetRadius;
            this.currentOrbitRadius = targetRadius + radiusDelta * altFactor;

            const omegaFactor = Math.pow(1 - p, 0.85);
            const currentAngularSpeed = this.orbitSpeed * omegaFactor;
            this.orbitAngle += currentAngularSpeed * dt;

            this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
            this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

            const dAlt_dp = -Math.PI * p * Math.sin(Math.PI * p * p);
            const dr_dt = (radiusDelta * dAlt_dp) / this.landingDuration;
            const dtheta_dt = currentAngularSpeed;

            const cosA = Math.cos(this.orbitAngle);
            const sinA = Math.sin(this.orbitAngle);

            this.vx = dr_dt * cosA - this.currentOrbitRadius * dtheta_dt * sinA;
            this.vy = dr_dt * sinA + this.currentOrbitRadius * dtheta_dt * cosA;

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
            this.thrusterState = 'none';
            this.landingProgress = null;
            this.initialLandingRadius = null;

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
            this.landingProgress = null;
            this.initialLandingRadius = null;

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
                const impactDist = this.targetPlanet.radius + 4;
                if (this.targetDist <= impactDist) {
                    handlePlanetImpact(this);
                    return;
                }
            }

            // 3. Arrival Steering Physics (Accelerate -> Coast -> Decelerate)
            const targetThreshold = isFriendly ? this.targetOrbitRadius : this.targetPlanet.radius;
            const distToThreshold = Math.max(0, this.targetDist - targetThreshold);

            const slowingRadius = 65; // Distance threshold to initiate slowing down
            let desiredSpeed = this.maxSpeed;

            if (distToThreshold < slowingRadius) {
                const ramp = distToThreshold / slowingRadius;
                desiredSpeed = Math.max(10, this.maxSpeed * ramp); // Floor of 10 px/s prevents stalling
            }

            const desiredVx = (this.targetDx / this.targetDist) * desiredSpeed;
            const desiredVy = (this.targetDy / this.targetDist) * desiredSpeed;

            const steeringX = desiredVx - this.vx;
            const steeringY = desiredVy - this.vy;

            let ax = steeringX * 8;
            let ay = steeringY * 8;

            const accelMag = Math.sqrt(ax * ax + ay * ay);
            if (accelMag > this.enginePower) {
                ax = (ax / accelMag) * this.enginePower;
                ay = (ay / accelMag) * this.enginePower;
            }

            // Determine Thruster Visual State
            const dotProduct = ax * this.vx + ay * this.vy;
            if (accelMag < 15) {
                this.thrusterState = 'none'; // Coasting at cruising speed
            } else if (dotProduct < -20) {
                this.thrusterState = 'retro'; // Braking
            } else {
                this.thrusterState = 'main'; // Accelerating
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