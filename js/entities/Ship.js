class Ship {
    constructor(sourcePlanet, targetPlanet) {
        this.owner = sourcePlanet.owner;
        this.orbitPlanet = sourcePlanet;
        this.targetPlanet = targetPlanet;

        const spawnAngle = Math.random() * Math.PI * 2;
        const minOrbitOffset = 14;
        const maxOrbitSpread = 22;
        this.targetOrbitRadius = sourcePlanet.radius + minOrbitOffset + Math.random() * maxOrbitSpread;

        // Physics & Engine Specs
        this.gravConst = 28000.0;
        this.mass = 1.0;
        this.maxSpeed = 65.0;
        this.enginePower = 120.0;
        this.transitTurnRate = 5.0;
        this.combatTurnRate = 12.0;

        this.orbitDir = Math.random() < 0.5 ? 1 : -1;
        this.launchStartAngle = spawnAngle; // Fixed initial launch angle reference
        this.orbitAngle = spawnAngle;

        // Launch & Landing Arc Control
        this.launchProgress = 0;
        this.launchDuration = 2.2; // Seconds for gravity turn ascent
        this.landingProgress = 0;
        this.landingDuration = 2.0; // Seconds for touchdown descent

        // Spawn on planet surface
        this.x = sourcePlanet.x + Math.cos(spawnAngle) * (sourcePlanet.radius + 2);
        this.y = sourcePlanet.y + Math.sin(spawnAngle) * (sourcePlanet.radius + 2);

        this.vx = 0;
        this.vy = 0;
        this.heading = spawnAngle;

        this.state = 'surface_launch';
        this.postLaunchState = sourcePlanet === targetPlanet ? 'orbit' : 'launching';

        this.dead = false;
        this.thrustRatio = 0;
        this.boidFx = 0;
        this.boidFy = 0;
    }

    get currentTurnRate() {
        return (this.state === 'insertion') ? this.combatTurnRate : this.transitTurnRate;
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
            return Math.abs(diff) < 0.35;
        }
    }

    computeBoidForces(ships) {
        let sepX = 0, sepY = 0;
        let alignX = 0, alignY = 0;
        let count = 0;

        for (let i = 0; i < ships.length; i++) {
            const other = ships[i];
            if (other !== this && !other.dead && other.owner === this.owner && other.state === 'moving' && other.targetPlanet === this.targetPlanet) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 0 && distSq < 1225) {
                    const dist = Math.sqrt(distSq);
                    if (dist < 20) {
                        const force = (20 - dist) / 20;
                        sepX -= (dx / dist) * force;
                        sepY -= (dy / dist) * force;
                    }
                    alignX += other.vx;
                    alignY += other.vy;
                    count++;
                }
            }
        }

        let fx = sepX * 12.0;
        let fy = sepY * 12.0;
        if (count > 0) {
            fx += ((alignX / count) - this.vx) * 0.5;
            fy += ((alignY / count) - this.vy) * 0.5;
        }

        const mag = Math.sqrt(fx * fx + fy * fy);
        if (mag > 12.0) {
            fx = (fx / mag) * 12.0;
            fy = (fy / mag) * 12.0;
        }
        this.boidFx = fx;
        this.boidFy = fy;
    }

    update(dt, gameManager) {
        if (this.dead) return;

        // --- 1. SEAMLESS GRAVITY TURN ASCENT ---
        if (this.state === 'surface_launch') {
            const planet = this.orbitPlanet;
            this.launchProgress += dt / this.launchDuration;
            const p = Math.min(1.0, this.launchProgress);

            const vCirc = Math.sqrt(this.gravConst / this.targetOrbitRadius);
            const omegaBase = vCirc / this.targetOrbitRadius;
            const angularVelocity = omegaBase * this.orbitDir; // Single signed angular rate

            // Altitude envelope: Smooth sine curve from surface outward to target orbit
            const currentR = planet.radius + 2.0 + (this.targetOrbitRadius - planet.radius - 2.0) * Math.sin(p * Math.PI / 2);

            // Orbit angle evolves seamlessly according to assigned orbitDir
            this.orbitAngle = this.launchStartAngle + angularVelocity * (this.launchDuration / 3.0) * Math.pow(p, 3);

            // Parametric radial and angular derivatives
            const drdt = (this.targetOrbitRadius - planet.radius - 2.0) * (Math.PI / (2 * this.launchDuration)) * Math.cos(p * Math.PI / 2);
            const dthetadt = angularVelocity * Math.pow(p, 2);

            this.x = planet.x + Math.cos(this.orbitAngle) * currentR;
            this.y = planet.y + Math.sin(this.orbitAngle) * currentR;

            // Physical velocity matching actual position derivatives
            this.vx = drdt * Math.cos(this.orbitAngle) - currentR * Math.sin(this.orbitAngle) * dthetadt;
            this.vy = drdt * Math.sin(this.orbitAngle) + currentR * Math.cos(this.orbitAngle) * dthetadt;

            // Nose points precisely along movement trajectory
            this.heading = Math.atan2(this.vy, this.vx);
            this.thrustRatio = 1.0;

            if (p >= 1.0) {
                this.state = this.postLaunchState;
            }
            return;
        }

        // --- 2. PARAMETRIC STABLE ORBIT ---
        if (this.state === 'orbit') {
            const planet = this.targetPlanet;
            const vCirc = Math.sqrt(this.gravConst / this.targetOrbitRadius);
            const angularVelocity = (vCirc / this.targetOrbitRadius) * this.orbitDir;

            this.orbitAngle += angularVelocity * dt;
            this.x = planet.x + Math.cos(this.orbitAngle) * this.targetOrbitRadius;
            this.y = planet.y + Math.sin(this.orbitAngle) * this.targetOrbitRadius;

            this.vx = -Math.sin(this.orbitAngle) * vCirc * this.orbitDir;
            this.vy = Math.cos(this.orbitAngle) * vCirc * this.orbitDir;
            this.heading = Math.atan2(this.vy, this.vx);
            this.thrustRatio = 0;
            return;
        }

        // --- 3. RETROGRADE LANDING TOUCHDOWN ARC ---
        if (this.state === 'landing') {
            const planet = this.targetPlanet;
            this.landingProgress += dt / this.landingDuration;
            const p = Math.min(1.0, this.landingProgress);

            const vCirc = Math.sqrt(this.gravConst / this.targetOrbitRadius);
            const omegaCirc = (vCirc / this.targetOrbitRadius) * this.orbitDir;

            const currentR = this.targetOrbitRadius - (this.targetOrbitRadius - planet.radius - 1.5) * (1.0 - Math.cos(p * Math.PI / 2));
            const dthetadt = omegaCirc * Math.pow(1.0 - p, 2);

            this.orbitAngle += dthetadt * dt;
            this.x = planet.x + Math.cos(this.orbitAngle) * currentR;
            this.y = planet.y + Math.sin(this.orbitAngle) * currentR;

            const orbitHeading = Math.atan2(Math.cos(this.orbitAngle) * this.orbitDir, -Math.sin(this.orbitAngle) * this.orbitDir);
            const surfaceHeading = Math.atan2(planet.y - this.y, planet.x - this.x);
            this.heading = orbitHeading * (1.0 - p) + surfaceHeading * p;

            this.thrustRatio = 0.5 * (1.0 - p);

            if (p >= 1.0) {
                gameManager.destroyShip(this);
                planet.upgradeProgress++;

                if (planet.owner === 0) {
                    planet.owner = this.owner;
                    planet.hp = TIER_STATS[planet.level].maxHP;
                    planet.upgradeProgress = 0;
                } else if (planet.upgradeProgress >= TIER_STATS[planet.level].upgradeCost) {
                    planet.upgrade(gameManager.ships);
                }
            }
            return;
        }

        // --- NEWTONIAN VECTOR PHYSICS FOR TRANSIT & INSERTION ---
        let totalFx = 0;
        let totalFy = 0;

        const refPlanet = this.orbitPlanet || this.targetPlanet;
        const dx = this.x - refPlanet.x;
        const dy = this.y - refPlanet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const rx = dx / dist;
        const ry = dy / dist;

        const angularMomentum = dx * this.vy - dy * this.vx;
        if (Math.abs(angularMomentum) > 0.1) {
            this.orbitDir = angularMomentum >= 0 ? 1 : -1;
        }

        const tx = -ry * this.orbitDir;
        const ty = rx * this.orbitDir;

        if (dist > 1.0) {
            const gAccel = this.gravConst / (dist * dist);
            totalFx -= rx * gAccel;
            totalFy -= ry * gAccel;
        }

        let desiredVx = 0;
        let desiredVy = 0;
        let requiresThrust = false;

        // --- 4. LAUNCHING HOLD ---
        if (this.state === 'launching') {
            const vCirc = Math.sqrt(this.gravConst / dist);
            desiredVx = tx * vCirc;
            desiredVy = ty * vCirc;
            requiresThrust = true;

            const targetDx = this.targetPlanet.x - this.x;
            const targetDy = this.targetPlanet.y - this.y;
            const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
            const alignment = tx * (targetDx / targetDist) + ty * (targetDy / targetDist);

            if (alignment >= 0.88) {
                this.state = 'moving';
                this.orbitPlanet = null;
            }
        }

        // --- 5. TRANSIT TO TARGET PLANET ---
        else if (this.state === 'moving') {
            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const vCirc = Math.sqrt(this.gravConst / this.targetOrbitRadius);

            const decelDist = Math.max(0, (currentSpeed * currentSpeed - vCirc * vCirc) / (2.0 * this.enginePower)) + 16.0;

            const pdx = this.targetPlanet.x - this.x;
            const pdy = this.targetPlanet.y - this.y;
            const distToPlanet = Math.sqrt(pdx * pdx + pdy * pdy);

            const isFriendly = (this.targetPlanet.owner === this.owner);
            const isUnclaimed = (this.targetPlanet.owner === 0);

            if ((isFriendly || isUnclaimed) && distToPlanet <= this.targetOrbitRadius + decelDist) {
                this.state = 'insertion';
                this.orbitPlanet = this.targetPlanet;
            } else if (!isFriendly && !isUnclaimed && distToPlanet <= this.targetPlanet.radius + 4.0) {
                gameManager.handlePlanetImpact(this);
                return;
            }

            const angleToShip = Math.atan2(this.y - this.targetPlanet.y, this.x - this.targetPlanet.x);
            const tangentAngle = angleToShip + (this.orbitDir * Math.PI / 2);

            const aimX = this.targetPlanet.x + Math.cos(tangentAngle) * this.targetOrbitRadius;
            const aimY = this.targetPlanet.y + Math.sin(tangentAngle) * this.targetOrbitRadius;

            const aimDx = aimX - this.x;
            const aimDy = aimY - this.y;
            const aimDist = Math.sqrt(aimDx * aimDx + aimDy * aimDy);

            this.computeBoidForces(gameManager.ships);
            desiredVx = (aimDx / aimDist) * this.maxSpeed + this.boidFx;
            desiredVy = (aimDy / aimDist) * this.maxSpeed + this.boidFy;
            requiresThrust = true;
        }

        // --- 6. ORBITAL INSERTION BRAKING BURN ---
        else if (this.state === 'insertion') {
            const vCirc = Math.sqrt(this.gravConst / dist);
            desiredVx = tx * vCirc;
            desiredVy = ty * vCirc;
            requiresThrust = true;

            const vr = this.vx * rx + this.vy * ry;
            const vt = this.vx * tx + this.vy * ty;

            if (Math.abs(vt - vCirc) < 4.0 && Math.abs(vr) < 3.0) {
                this.orbitAngle = Math.atan2(dy, dx);
                this.targetOrbitRadius = dist;

                const isUnclaimed = (this.targetPlanet.owner === 0);
                const isFriendlyLanding = (this.targetPlanet.owner === this.owner && this.targetPlanet.isLanding);

                if (isUnclaimed || isFriendlyLanding) {
                    this.state = 'landing';
                    this.landingProgress = 0;
                } else {
                    this.state = 'orbit';
                }
            }
        }

        // --- STEERING & INTEGRATION CONTROLLER ---
        if (requiresThrust) {
            const errVx = desiredVx - this.vx;
            const errVy = desiredVy - this.vy;
            const errMag = Math.sqrt(errVx * errVx + errVy * errVy);

            if (errMag > 1.0) {
                const targetHeading = Math.atan2(errVy, errVx);
                const aligned = this.rotateTowards(targetHeading, dt);

                if (aligned) {
                    this.thrustRatio = Math.min(1.0, errMag / 25.0);
                    const accel = this.enginePower * this.thrustRatio;
                    totalFx += Math.cos(this.heading) * accel;
                    totalFy += Math.sin(this.heading) * accel;
                } else {
                    this.thrustRatio = 0;
                }
            } else {
                this.thrustRatio = 0;
            }
        } else {
            this.thrustRatio = 0;
        }

        this.vx += (totalFx / this.mass) * dt;
        this.vy += (totalFy / this.mass) * dt;

        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const speedCap = this.state === 'moving' ? this.maxSpeed * 1.2 : this.maxSpeed;
        if (currentSpeed > speedCap) {
            this.vx = (this.vx / currentSpeed) * speedCap;
            this.vy = (this.vy / currentSpeed) * speedCap;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.heading);

        ctx.fillStyle = OWNER_COLORS[this.owner];
        ctx.beginPath();
        ctx.moveTo(3.5, 0);
        ctx.lineTo(-2.5, -2.0);
        ctx.lineTo(-1.0, 0);
        ctx.lineTo(-2.5, 2.0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    drawThrusters(ctx) {
        if (this.dead || this.thrustRatio <= 0.05) return;

        ctx.save();
        const plumeX = this.x - Math.cos(this.heading) * 3.0;
        const plumeY = this.y - Math.sin(this.heading) * 3.0;
        const plumeRadius = 0.8 + this.thrustRatio * 1.0;

        ctx.fillStyle = this.thrustRatio > 0.5 ? '#ffaa11' : '#66ccff';
        ctx.beginPath();
        ctx.arc(plumeX, plumeY, plumeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}