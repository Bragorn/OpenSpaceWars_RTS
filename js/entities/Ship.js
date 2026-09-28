class Ship {
    constructor(sourcePlanet, targetPlanet) {
        this.owner = sourcePlanet.owner;
        this.orbitPlanet = sourcePlanet;
        this.targetPlanet = targetPlanet;

        const spawnAngle = Math.random() * Math.PI * 2;
        this.orbitAngle = spawnAngle;

        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = 38;
        this.enginePower = 60;
        this.turnRate = 12.0; // Max rotation speed in radians per second

        const minOrbitOffset = 10;
        const maxOrbitSpread = 22;
        this.targetOrbitRadius = sourcePlanet.radius + minOrbitOffset + Math.random() * maxOrbitSpread;
        this.orbitSpeed = (2.2 + Math.random() * 0.5) / Math.sqrt(this.targetOrbitRadius);

        // Surface Launch Setup
        this.initialLaunchRadius = sourcePlanet.radius + 1.5;
        this.currentOrbitRadius = this.initialLaunchRadius;
        this.launchProgress = 0;
        this.launchDuration = 2.2;

        this.x = sourcePlanet.x + Math.cos(spawnAngle) * this.currentOrbitRadius;
        this.y = sourcePlanet.y + Math.sin(spawnAngle) * this.currentOrbitRadius;

        // Facing straight outward from planet surface on spawn
        this.heading = spawnAngle;

        this.state = 'surface_launch';
        this.postLaunchState = sourcePlanet === targetPlanet ? 'orbit' : 'launching';

        this.initialLandingRadius = null;
        this.landingProgress = null;
        this.landingDuration = 3.8;

        this.isIntercepting = false;
        this.isReturningToOrbit = false;
        this.dead = false;
        this.thrusterState = 'main';
    }

    // Smoothly rotates current heading towards target angle
    rotateTowards(targetHeading, dt) {
        let diff = targetHeading - this.heading;

        // Wrap angle difference to [-PI, PI]
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const maxTurn = this.turnRate * dt;
        if (Math.abs(diff) <= maxTurn) {
            this.heading = targetHeading;
            return true; // Fully aligned
        } else {
            this.heading += Math.sign(diff) * maxTurn;
            return Math.abs(diff) < 0.6; // Aligned enough for thruster burst (~35 degrees)
        }
    }

    getBoidForces(ships) {
        let sepX = 0, sepY = 0;
        let alignX = 0, alignY = 0;
        let cohortX = 0, cohortY = 0;
        let neighborCount = 0;

        const neighborDist = 32;
        const sepDist = 12;

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

    update(dt, gameManager) {
        if (this.dead) return;

        // SURFACE LAUNCH MODE
        if (this.state === 'surface_launch') {
            this.launchProgress += dt / this.launchDuration;
            const p = Math.min(1, Math.max(0, this.launchProgress));

            const altFactor = 1 - Math.pow(1 - p, 2);
            const radiusDelta = this.targetOrbitRadius - this.initialLaunchRadius;
            this.currentOrbitRadius = this.initialLaunchRadius + radiusDelta * altFactor;

            const currentAngularSpeed = this.orbitSpeed * Math.pow(p, 0.8);
            this.orbitAngle += currentAngularSpeed * dt;

            this.x = this.orbitPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
            this.y = this.orbitPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

            const dAlt_dt = 2 * (1 - p) * (radiusDelta / this.launchDuration);
            const cosA = Math.cos(this.orbitAngle);
            const sinA = Math.sin(this.orbitAngle);

            this.vx = dAlt_dt * cosA - this.currentOrbitRadius * currentAngularSpeed * sinA;
            this.vy = dAlt_dt * sinA + this.currentOrbitRadius * currentAngularSpeed * cosA;

            const targetH = Math.atan2(this.vy, this.vx);
            const isAligned = this.rotateTowards(targetH, dt);
            this.thrusterState = isAligned ? 'main' : 'none';

            if (p >= 1.0) {
                this.currentOrbitRadius = this.targetOrbitRadius;
                this.state = this.postLaunchState;
            }
            return;
        }

        // LAUNCHING MODE
        if (this.state === 'launching') {
            this.landingProgress = null;
            this.initialLandingRadius = null;
            this.thrusterState = 'none';

            this.orbitAngle += this.orbitSpeed * dt;
            this.x = this.orbitPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
            this.y = this.orbitPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

            this.rotateTowards(this.orbitAngle + Math.PI / 2, dt);

            const tangentX = -Math.sin(this.orbitAngle);
            const tangentY = Math.cos(this.orbitAngle);

            const dx = this.targetPlanet.x - this.x;
            const dy = this.targetPlanet.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                const alignment = tangentX * (dx / dist) + tangentY * (dy / dist);
                if (alignment >= 0.96) {
                    this.state = 'moving';
                    this.orbitPlanet = null;
                    this.vx = tangentX * (this.maxSpeed * 0.8);
                    this.vy = tangentY * (this.maxSpeed * 0.8);
                    this.thrusterState = 'main';
                }
            }
            return;
        }

        // LANDING MODE (SpaceX Tail-First Retrograde Descent)
        if (this.state === 'landing') {
            if (this.landingProgress === null) {
                this.landingProgress = 0;
                const dx = this.x - this.targetPlanet.x;
                const dy = this.y - this.targetPlanet.y;
                this.initialLandingRadius = Math.sqrt(dx * dx + dy * dy);
                this.orbitAngle = Math.atan2(dy, dx);
            }

            this.landingProgress += dt / this.landingDuration;
            const p = Math.min(1, Math.max(0, this.landingProgress));

            const altFactor = Math.pow(1 - p, 2);
            const targetRadius = this.targetPlanet.radius + 1.5;
            const radiusDelta = this.initialLandingRadius - targetRadius;
            this.currentOrbitRadius = targetRadius + radiusDelta * altFactor;

            const currentAngularSpeed = this.orbitSpeed * Math.pow(1 - p, 1.2);
            this.orbitAngle += currentAngularSpeed * dt;

            this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
            this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

            const dAlt_dt = -2 * (1 - p) * (radiusDelta / this.landingDuration);
            const cosA = Math.cos(this.orbitAngle);
            const sinA = Math.sin(this.orbitAngle);

            this.vx = dAlt_dt * cosA - this.currentOrbitRadius * currentAngularSpeed * sinA;
            this.vy = dAlt_dt * sinA + this.currentOrbitRadius * currentAngularSpeed * cosA;

            // Target retrograde orientation (+ Math.PI)
            const retroTarget = Math.atan2(this.vy, this.vx) + Math.PI;
            const isAligned = this.rotateTowards(retroTarget, dt);
            this.thrusterState = isAligned ? 'main' : 'none';

            if (p >= 1.0) {
                gameManager.destroyShip(this);
                this.targetPlanet.upgradeProgress++;
                const reqCost = TIER_STATS[this.targetPlanet.level].upgradeCost;
                if (this.targetPlanet.upgradeProgress >= reqCost) {
                    this.targetPlanet.upgrade(gameManager.ships);
                }
            }
            return;
        }

        // ORBIT & DEFENSE MODE
        if (this.state === 'orbit') {
            this.landingProgress = null;
            this.initialLandingRadius = null;
            this.orbitPlanet = this.targetPlanet;

            let targetEnemy = null;
            let minEnemyDistSq = 3600;

            for (let i = 0; i < gameManager.ships.length; i++) {
                const other = gameManager.ships[i];
                if (other !== this && !other.dead && other.owner !== this.owner) {
                    const dxPlanet = other.x - this.targetPlanet.x;
                    const dyPlanet = other.y - this.targetPlanet.y;
                    if (dxPlanet * dxPlanet + dyPlanet * dyPlanet < minEnemyDistSq) {
                        if (!isPathBlockedByPlanet(this.x, this.y, other.x, other.y, this.targetPlanet, 2)) {
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
            }

            if (targetEnemy) {
                this.isIntercepting = true;
                this.isReturningToOrbit = false;

                const dx = targetEnemy.x - this.x;
                const dy = targetEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 25) {
                    gameManager.destroyShip(this);
                    gameManager.destroyShip(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.vx = (dx / dist) * (this.maxSpeed * 1.3);
                    this.vy = (dy / dist) * (this.maxSpeed * 1.3);
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;

                    const targetH = Math.atan2(this.vy, this.vx);
                    const isAligned = this.rotateTowards(targetH, dt);
                    this.thrusterState = isAligned ? 'main' : 'none';
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
                    const radialVelocity = Math.min(Math.abs(radiusDiff) * 3.0, 14);
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

                    const targetH = Math.atan2(this.vy, this.vx);
                    const isAligned = this.rotateTowards(targetH, dt);
                    this.thrusterState = isAligned ? 'main' : 'none';
                } else {
                    this.isReturningToOrbit = false;
                    this.thrusterState = 'none';
                    this.orbitAngle += this.orbitSpeed * dt;
                    this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                    this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;
                    this.rotateTowards(this.orbitAngle + Math.PI / 2, dt);
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

            // Enemy Intercept
            let targetEnemy = null;
            let minEnemyDistSq = 900;

            for (let i = 0; i < gameManager.ships.length; i++) {
                const other = gameManager.ships[i];
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
                    gameManager.destroyShip(this);
                    gameManager.destroyShip(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.vx = (dx / dist) * this.maxSpeed;
                    this.vy = (dy / dist) * this.maxSpeed;
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;

                    const targetH = Math.atan2(this.vy, this.vx);
                    const isAligned = this.rotateTowards(targetH, dt);
                    this.thrusterState = isAligned ? 'main' : 'none';
                    return;
                }
            }

            // Target Planet Arrival Check
            const targetDx = this.targetPlanet.x - this.x;
            const targetDy = this.targetPlanet.y - this.y;
            const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);

            const isFriendly = (this.targetPlanet.owner === this.owner);
            const isLandingTarget = isFriendly && this.targetPlanet.isLanding;

            if (isFriendly) {
                if (isLandingTarget && targetDist <= this.targetOrbitRadius) {
                    this.state = 'landing';
                    return;
                } else if (!isLandingTarget && targetDist <= this.targetOrbitRadius + 2) {
                    this.state = 'orbit';
                    this.orbitPlanet = this.targetPlanet;
                    this.orbitAngle = Math.atan2(this.y - this.targetPlanet.y, this.x - this.targetPlanet.x);
                    this.currentOrbitRadius = targetDist;
                    return;
                }
            } else {
                if (targetDist <= this.targetPlanet.radius + 3) {
                    gameManager.handlePlanetImpact(this);
                    return;
                }
            }

            // Steering & Obstacle Avoidance
            const targetThreshold = isFriendly ? this.targetOrbitRadius : this.targetPlanet.radius;
            const distToThreshold = Math.max(0, targetDist - targetThreshold);
            
            const slowingRadius = 40;
            const flipAnticipationRadius = 65; // Begin rotation turn before braking starts

            let desiredSpeed = this.maxSpeed;
            if (distToThreshold < slowingRadius) {
                const ramp = distToThreshold / slowingRadius;
                desiredSpeed = Math.max(6, this.maxSpeed * Math.pow(ramp, 1.1));
            }

            let desiredVx = (targetDx / targetDist) * desiredSpeed;
            let desiredVy = (targetDy / targetDist) * desiredSpeed;

            // Planet Avoidance
            for (let i = 0; i < gameManager.planets.length; i++) {
                const p = gameManager.planets[i];
                if (p === this.targetPlanet) continue;

                const pdx = this.x - p.x;
                const pdy = this.y - p.y;
                const pDistSq = pdx * pdx + pdy * pdy;
                const avoidRadius = p.radius + 22;

                if (pDistSq < avoidRadius * avoidRadius) {
                    const pDist = Math.sqrt(pDistSq);
                    if (pDist > 0) {
                        const pushFactor = (avoidRadius - pDist) / avoidRadius;
                        desiredVx += (pdx / pDist) * pushFactor * this.maxSpeed * 1.5;
                        desiredVy += (pdy / pDist) * pushFactor * this.maxSpeed * 1.5;
                    }
                }
            }

            // Flocking
            const boid = this.getBoidForces(gameManager.ships);
            desiredVx += boid.x;
            desiredVy += boid.y;

            let ax = (desiredVx - this.vx) * 6;
            let ay = (desiredVy - this.vy) * 6;

            const accelMag = Math.sqrt(ax * ax + ay * ay);
            if (accelMag > this.enginePower) {
                ax = (ax / accelMag) * this.enginePower;
                ay = (ay / accelMag) * this.enginePower;
            }

            this.vx += ax * dt;
            this.vy += ay * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Orientation & Thruster Logic
            const dotProduct = ax * this.vx + ay * this.vy;
            const isPreparingToBrake = (distToThreshold < flipAnticipationRadius) || (dotProduct < -15);

            let targetH = Math.atan2(this.vy, this.vx);
            if (isPreparingToBrake) {
                targetH += Math.PI; // Rotate tail-first for retro burn
            }

            const isAligned = this.rotateTowards(targetH, dt);

            if (accelMag < 12) {
                this.thrusterState = 'none';
            } else if (isAligned) {
                this.thrusterState = 'main';
            } else {
                this.thrusterState = 'none'; // Hold thrust until ship completes turn
            }
        }
    }

    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.heading);

        ctx.fillStyle = OWNER_COLORS[this.owner];
        ctx.beginPath();
        ctx.moveTo(4.5, 0);       // Nose
        ctx.lineTo(-3.5, -3);    // Left wing
        ctx.lineTo(-2, 0);       // Engine notch
        ctx.lineTo(-3.5, 3);     // Right wing
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    drawThrusters(ctx) {
        if (this.dead || this.thrusterState === 'none') return;

        ctx.save();
        if (this.thrusterState === 'main') {
            ctx.fillStyle = '#ffaa11';
            const plumeX = this.x - Math.cos(this.heading) * 5;
            const plumeY = this.y - Math.sin(this.heading) * 5;
            ctx.beginPath();
            ctx.arc(plumeX, plumeY, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}