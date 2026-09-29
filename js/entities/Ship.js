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
        this.enginePower = 50;

        // Contextual Turn Rates
        this.transitTurnRate = 3.5; // Heavy momentum for long travel & landing
        this.combatTurnRate = 12.0;  // Highly agile RCS thrusters for dogfighting

        const minOrbitOffset = 10;
        const maxOrbitSpread = 22;
        this.targetOrbitRadius = sourcePlanet.radius + minOrbitOffset + Math.random() * maxOrbitSpread;
        this.orbitSpeed = (2.2 + Math.random() * 0.5) / Math.sqrt(this.targetOrbitRadius);

        // Surface Launch Setup
        this.initialLaunchRadius = sourcePlanet.radius + 1.5;
        this.currentOrbitRadius = this.initialLaunchRadius;
        this.launchProgress = 0;
        this.launchDuration = 2.0;

        this.x = sourcePlanet.x + Math.cos(spawnAngle) * this.currentOrbitRadius;
        this.y = sourcePlanet.y + Math.sin(spawnAngle) * this.currentOrbitRadius;

        this.heading = spawnAngle;

        this.state = 'surface_launch';
        this.postLaunchState = sourcePlanet === targetPlanet ? 'orbit' : 'launching';

        this.initialLandingRadius = null;
        this.landingProgress = null;
        this.landingDuration = 3.2;

        this.isIntercepting = false;
        this.dead = false;
        this.thrusterState = 'main';

        // Performance & State
        this.cachedEnemy = null;
        this.targetScanTimer = Math.random() * 0.15;
        this.boidFx = 0;
        this.boidFy = 0;
        this.isBraking = false;
        this.lastRetroHeading = null;
    }

    get currentTurnRate() {
        if (this.isIntercepting || (this.state === 'moving' && this.cachedEnemy)) {
            return this.combatTurnRate;
        }
        return this.transitTurnRate;
    }

    rotateTowards(targetHeading, dt) {
        let diff = targetHeading - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));

        const maxTurn = this.currentTurnRate * dt;
        if (Math.abs(diff) <= maxTurn) {
            this.heading = targetHeading;
            return true;
        } else {
            this.heading += Math.sign(diff) * maxTurn;
            return Math.abs(diff) < 0.5;
        }
    }

    computeBoidForces(ships) {
        let sepX = 0, sepY = 0;
        let alignX = 0, alignY = 0;
        let neighborCount = 0;

        const neighborDistSq = 900;
        const sepDist = 14;

        for (let i = 0; i < ships.length; i++) {
            const other = ships[i];
            if (other !== this && !other.dead && other.owner === this.owner && other.state === 'moving' && other.targetPlanet === this.targetPlanet) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 0 && distSq < neighborDistSq) {
                    const dist = Math.sqrt(distSq);
                    if (dist < sepDist) {
                        const force = (sepDist - dist) / sepDist;
                        sepX -= (dx / dist) * force;
                        sepY -= (dy / dist) * force;
                    }
                    alignX += other.vx;
                    alignY += other.vy;
                    neighborCount++;
                }
            }
        }

        let fx = sepX * 15;
        let fy = sepY * 15;

        if (neighborCount > 0) {
            alignX /= neighborCount;
            alignY /= neighborCount;
            fx += (alignX - this.vx) * 0.5;
            fy += (alignY - this.vy) * 0.5;
        }

        const forceMag = Math.sqrt(fx * fx + fy * fy);
        const maxBoidForce = 8.0;
        if (forceMag > maxBoidForce) {
            fx = (fx / forceMag) * maxBoidForce;
            fy = (fy / forceMag) * maxBoidForce;
        }

        this.boidFx = fx;
        this.boidFy = fy;
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

            const speedSq = this.vx * this.vx + this.vy * this.vy;
            if (speedSq > 0.1) {
                const targetH = Math.atan2(this.vy, this.vx);
                const isAligned = this.rotateTowards(targetH, dt);
                this.thrusterState = isAligned ? 'main' : 'none';
            }

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
            this.lastRetroHeading = null;
            this.thrusterState = 'none';

            this.orbitAngle += this.orbitSpeed * dt;
            this.x = this.orbitPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
            this.y = this.orbitPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

            this.rotateTowards(this.orbitAngle + Math.PI / 2, dt);

            const tangentX = -Math.sin(this.orbitAngle);
            const tangentY = Math.cos(this.orbitAngle);

            const dx = this.targetPlanet.x - this.x;
            const dy = this.targetPlanet.y - this.y;
            const distSq = dx * dx + dy * dy;

            if (distSq > 0) {
                const dist = Math.sqrt(distSq);
                const alignment = tangentX * (dx / dist) + tangentY * (dy / dist);
                if (alignment >= 0.95) {
                    this.state = 'moving';
                    this.orbitPlanet = null;
                    this.vx = tangentX * (this.maxSpeed * 0.85);
                    this.vy = tangentY * (this.maxSpeed * 0.85);
                    this.thrusterState = 'main';
                }
            }
            return;
        }

        // LANDING MODE
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

            const speedSq = this.vx * this.vx + this.vy * this.vy;
            if (speedSq > 1.0) {
                this.lastRetroHeading = Math.atan2(this.vy, this.vx) + Math.PI;
            } else if (!this.lastRetroHeading) {
                this.lastRetroHeading = Math.atan2(this.y - this.targetPlanet.y, this.x - this.targetPlanet.x);
            }

            const isAligned = this.rotateTowards(this.lastRetroHeading, dt);
            this.thrusterState = (isAligned && p < 0.92) ? 'main' : 'none';

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
            this.lastRetroHeading = null;
            this.orbitPlanet = this.targetPlanet;

            // Target scan
            this.targetScanTimer -= dt;
            if (this.targetScanTimer <= 0) {
                this.targetScanTimer = 0.12;
                this.cachedEnemy = null;
                let minEnemyDistSq = 4900; // 70px engagement range

                for (let i = 0; i < gameManager.ships.length; i++) {
                    const other = gameManager.ships[i];
                    if (other !== this && !other.dead && other.owner !== this.owner) {
                        const dx = other.x - this.x;
                        const dy = other.y - this.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < minEnemyDistSq) {
                            minEnemyDistSq = distSq;
                            this.cachedEnemy = other;
                        }
                    }
                }
            }

            // ACTIVE INTERCEPT (Dogfight)
            if (this.cachedEnemy && !this.cachedEnemy.dead) {
                this.isIntercepting = true;

                const dx = this.cachedEnemy.x - this.x;
                const dy = this.cachedEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 36) {
                    gameManager.destroyShip(this);
                    gameManager.destroyShip(this.cachedEnemy);
                    return;
                }

                const dist = Math.sqrt(distSq);
                const targetVx = (dx / dist) * (this.maxSpeed * 1.3);
                const targetVy = (dy / dist) * (this.maxSpeed * 1.3);

                this.vx += (targetVx - this.vx) * 10 * dt;
                this.vy += (targetVy - this.vy) * 10 * dt;

                this.x += this.vx * dt;
                this.y += this.vy * dt;

                const targetH = Math.atan2(this.vy, this.vx);
                const isAligned = this.rotateTowards(targetH, dt);
                this.thrusterState = isAligned ? 'main' : 'none';
            } 
            // ORBIT RECAPTURE WITH ACTIVE THRUST & TRAJECTORY CANTING
            else {
                if (this.isIntercepting) {
                    this.isIntercepting = false;
                    const dxPlanet = this.x - this.targetPlanet.x;
                    const dyPlanet = this.y - this.targetPlanet.y;
                    this.currentOrbitRadius = Math.sqrt(dxPlanet * dxPlanet + dyPlanet * dyPlanet);
                    this.orbitAngle = Math.atan2(dyPlanet, dxPlanet);
                }

                const radiusDiff = this.targetOrbitRadius - this.currentOrbitRadius;
                const needsAltitudeCorrection = Math.abs(radiusDiff) > 0.8;

                if (needsAltitudeCorrection) {
                    // Radial velocity component (spiral inward or outward)
                    const radialSpeed = Math.sign(radiusDiff) * Math.min(Math.abs(radiusDiff) * 3.5, 20);
                    this.currentOrbitRadius += radialSpeed * dt;

                    // Tangential orbital velocity progression
                    this.orbitAngle += this.orbitSpeed * dt;

                    const nextX = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                    const nextY = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

                    // Derive true motion vector
                    this.vx = (nextX - this.x) / dt;
                    this.vy = (nextY - this.y) / dt;

                    this.x = nextX;
                    this.y = nextY;

                    // Orient ship along actual spiral flight vector & fire thruster burn
                    const flightVectorHeading = Math.atan2(this.vy, this.vx);
                    const isAligned = this.rotateTowards(flightVectorHeading, dt);
                    this.thrusterState = isAligned ? 'main' : 'none';
                } else {
                    // Stable free orbit (coasting, thrusters off)
                    this.currentOrbitRadius = this.targetOrbitRadius;
                    this.orbitAngle += this.orbitSpeed * dt;

                    this.x = this.targetPlanet.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                    this.y = this.targetPlanet.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

                    this.rotateTowards(this.orbitAngle + Math.PI / 2, dt);
                    this.thrusterState = 'none';
                }
            }
            return;
        }

        // INTERPLANETARY TRANSIT MODE
        if (this.state === 'moving') {
            this.landingProgress = null;
            this.initialLandingRadius = null;
            this.lastRetroHeading = null;
            this.isIntercepting = false;

            this.targetScanTimer -= dt;
            if (this.targetScanTimer <= 0) {
                this.targetScanTimer = 0.1;
                this.cachedEnemy = null;
                let minEnemyDistSq = 1225;

                for (let i = 0; i < gameManager.ships.length; i++) {
                    const other = gameManager.ships[i];
                    if (other !== this && !other.dead && other.owner !== this.owner) {
                        const dx = other.x - this.x;
                        const dy = other.y - this.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < minEnemyDistSq) {
                            minEnemyDistSq = distSq;
                            this.cachedEnemy = other;
                        }
                    }
                }
            }

            if (this.cachedEnemy && !this.cachedEnemy.dead) {
                const dx = this.cachedEnemy.x - this.x;
                const dy = this.cachedEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 36) {
                    gameManager.destroyShip(this);
                    gameManager.destroyShip(this.cachedEnemy);
                    return;
                }

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

            const targetDx = this.targetPlanet.x - this.x;
            const targetDy = this.targetPlanet.y - this.y;
            const targetDistSq = targetDx * targetDx + targetDy * targetDy;
            const targetDist = Math.sqrt(targetDistSq);

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

            const targetThreshold = isFriendly ? this.targetOrbitRadius : this.targetPlanet.radius;
            const distToThreshold = Math.max(0, targetDist - targetThreshold);

            const slowingRadius = 45;
            const flipAnticipationRadius = 55;

            let desiredSpeed = this.maxSpeed;
            if (distToThreshold < slowingRadius) {
                const ramp = distToThreshold / slowingRadius;
                desiredSpeed = Math.max(8, this.maxSpeed * Math.pow(ramp, 1.1));
            }

            let desiredVx = (targetDx / targetDist) * desiredSpeed;
            let desiredVy = (targetDy / targetDist) * desiredSpeed;

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
                        desiredVx += (pdx / pDist) * pushFactor * this.maxSpeed * 1.2;
                        desiredVy += (pdy / pDist) * pushFactor * this.maxSpeed * 1.2;
                    }
                }
            }

            this.computeBoidForces(gameManager.ships);
            desiredVx += this.boidFx;
            desiredVy += this.boidFy;

            let ax = (desiredVx - this.vx) * 5;
            let ay = (desiredVy - this.vy) * 5;

            const accelMag = Math.sqrt(ax * ax + ay * ay);
            if (accelMag > this.enginePower) {
                ax = (ax / accelMag) * this.enginePower;
                ay = (ay / accelMag) * this.enginePower;
            }

            this.vx += ax * dt;
            this.vy += ay * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            if (distToThreshold < flipAnticipationRadius) {
                this.isBraking = true;
            } else if (distToThreshold > flipAnticipationRadius + 20) {
                this.isBraking = false;
            }

            const speedSq = this.vx * this.vx + this.vy * this.vy;
            if (speedSq > 0.1) {
                let targetH = Math.atan2(this.vy, this.vx);
                if (this.isBraking) {
                    targetH += Math.PI;
                }

                const isAligned = this.rotateTowards(targetH, dt);

                if (accelMag < 8) {
                    this.thrusterState = 'none';
                } else if (isAligned) {
                    this.thrusterState = 'main';
                } else {
                    this.thrusterState = 'none';
                }
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