function hasLineOfSight(p1, p2, planets) {
    if (!planets || !Array.isArray(planets)) return true;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq === 0) return true;

    for (let i = 0; i < planets.length; i++) {
        const planet = planets[i];
        if (!planet) continue;

        const pdx = planet.x - p1.x;
        const pdy = planet.y - p1.y;

        // Project planet center onto the laser line segment (clamped 0 to 1)
        const u = Math.max(0, Math.min(1, (pdx * dx + pdy * dy) / lineLenSq));

        const closestX = p1.x + u * dx;
        const closestY = p1.y + u * dy;

        const distSq = (planet.x - closestX) * (planet.x - closestX) + (planet.y - closestY) * (planet.y - closestY);

        // Planet radius + 2px buffer to keep lasers from clipping planet edges
        const blockRadius = (planet.radius || 28) + 2;

        if (distSq < blockRadius * blockRadius) {
            return false; // Intersects a planet
        }
    }

    return true;
}

function findBlockingPlanet(p1, p2, planets, ignoreList = []) {
    if (!planets || !Array.isArray(planets)) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lineLenSq = dx * dx + dy * dy;
    if (lineLenSq === 0) return null;

    let closestBlocker = null;
    let minU = Infinity;

    for (let i = 0; i < planets.length; i++) {
        const planet = planets[i];
        if (!planet || ignoreList.includes(planet)) continue;

        const pdx = planet.x - p1.x;
        const pdy = planet.y - p1.y;

        // Projection factor u along path (0 = p1, 1 = p2)
        const u = (pdx * dx + pdy * dy) / lineLenSq;

        // Check obstacle planets lying ahead between start and destination
        if (u > 0.05 && u < 0.92) {
            const closestX = p1.x + u * dx;
            const closestY = p1.y + u * dy;
            const distSq = (planet.x - closestX) * (planet.x - closestX) + (planet.y - closestY) * (planet.y - closestY);

            // Safety corridor radius
            const corridorRadius = (planet.radius || 28) + 24;

            if (distSq < corridorRadius * corridorRadius) {
                if (u < minU) {
                    minU = u;
                    closestBlocker = planet;
                }
            }
        }
    }

    return closestBlocker;
}

class Ship {
    constructor(sourcePlanet, targetPlanet) {
        this.owner = sourcePlanet ? sourcePlanet.owner : 0;
        this.orbitPlanet = sourcePlanet;
        this.targetPlanet = targetPlanet || sourcePlanet;

        const baseRadius = (sourcePlanet && sourcePlanet.radius) ? sourcePlanet.radius : 28;
        const spawnAngle = Math.random() * Math.PI * 2;
        const minOrbitOffset = 14;
        const maxOrbitSpread = 22;
        this.targetOrbitRadius = baseRadius + minOrbitOffset + Math.random() * maxOrbitSpread;

        // --- Physics Specs ---
        this.gravConst = 12000.0;
        this.mass = 1.0;
        this.maxSpeed = 42.0;
        this.enginePower = 70.0;
        this.transitTurnRate = 5.0;
        this.combatTurnRate = 12.0;

        // Combat Stats
        this.hp = 20;
        this.maxHp = 20;
        this.shootCooldown = Math.random() * 0.4;
        this.laserTarget = null;
        this.laserTimer = 0;

        this.orbitDir = Math.random() < 0.5 ? 1 : -1;
        this.launchStartAngle = spawnAngle; 
        this.orbitAngle = spawnAngle;

        // Flyby Navigation State
        this.flybyPlanet = null;
        this.lastFlybyPlanet = null;
        this.flybySide = 1;
        this.flybyTimer = 0;

        // Timers
        this.launchProgress = 0;
        this.launchDuration = 2.2;
        this.landingProgress = 0;
        this.landingDuration = 2.0;
        this.orbitTimer = 0;

        // Surface spawn
        const startX = sourcePlanet ? sourcePlanet.x : 0;
        const startY = sourcePlanet ? sourcePlanet.y : 0;
        this.x = startX + Math.cos(spawnAngle) * (baseRadius + 2);
        this.y = startY + Math.sin(spawnAngle) * (baseRadius + 2);

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
        return (this.state === 'insertion' || this.state === 'orbit') ? this.combatTurnRate : this.transitTurnRate;
    }

    takeDamage(amount, gameManager) {
        if (this.dead) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.dead = true;
            if (gameManager && typeof gameManager.destroyShip === 'function') {
                gameManager.destroyShip(this);
            }
        }
    }

    rotateTowards(targetHeading, dt) {
        if (isNaN(targetHeading)) return false;

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
        if (!ships || !Array.isArray(ships)) return;

        let sepX = 0, sepY = 0;
        let alignX = 0, alignY = 0;
        let count = 0;

        for (let i = 0; i < ships.length; i++) {
            const other = ships[i];
            if (other && other !== this && !other.dead && other.owner === this.owner && other.state === 'moving' && other.targetPlanet === this.targetPlanet) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 0.01 && distSq < 1225) {
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
        this.boidFx = isNaN(fx) ? 0 : fx;
        this.boidFy = isNaN(fy) ? 0 : fy;
    }

    findNearestEnemy(gameManager, maxRange = 90.0) {
        if (isNaN(this.x) || isNaN(this.y)) return null;

        let nearestEnemy = null;
        let minDist = maxRange;
        const planets = (gameManager && Array.isArray(gameManager.planets)) ? gameManager.planets : null;

        if (gameManager && Array.isArray(gameManager.ships)) {
            for (let i = 0; i < gameManager.ships.length; i++) {
                const other = gameManager.ships[i];
                if (other && other !== this && !other.dead && other.owner !== this.owner) {
                    const edx = other.x - this.x;
                    const edy = other.y - this.y;
                    const edist = Math.sqrt(edx * edx + edy * edy);
                    if (edist < minDist) {
                        if (hasLineOfSight(this, other, planets)) {
                            minDist = edist;
                            nearestEnemy = other;
                        }
                    }
                }
            }
        }
        return nearestEnemy;
    }

    fireLaser(target, gameManager) {
        if (this.shootCooldown <= 0 && target && !target.dead) {
            const planets = (gameManager && Array.isArray(gameManager.planets)) ? gameManager.planets : null;
            if (!hasLineOfSight(this, target, planets)) return;

            target.takeDamage(10, gameManager);
            this.laserTarget = { x: target.x, y: target.y };
            this.laserTimer = 0.08;
            this.shootCooldown = 0.45 + Math.random() * 0.2;
        }
    }

    update(dtUncapped, gameManager) {
        if (this.dead) return;

        const dt = Math.min(dtUncapped || 0.016, 0.1);

        if (this.laserTimer > 0) this.laserTimer -= dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // Reset lastFlybyPlanet when safely clear
        if (this.lastFlybyPlanet) {
            const ldx = this.x - this.lastFlybyPlanet.x;
            const ldy = this.y - this.lastFlybyPlanet.y;
            if (ldx * ldx + ldy * ldy > 180 * 180) {
                this.lastFlybyPlanet = null;
            }
        }

        // 1. Surface Launch
        if (this.state === 'surface_launch') {
            const planet = this.orbitPlanet || this.targetPlanet;
            if (!planet) return;

            this.launchProgress += dt / this.launchDuration;
            const p = Math.min(1.0, this.launchProgress);

            const safeR = Math.max(1, this.targetOrbitRadius);
            const vCirc = Math.sqrt(this.gravConst / safeR);
            const omegaBase = vCirc / safeR;
            const angularVelocity = omegaBase * this.orbitDir;

            const pRad = planet.radius || 28;
            const currentR = pRad + 2.0 + (safeR - pRad - 2.0) * Math.sin(p * Math.PI / 2);
            const turnFactor = Math.pow(p, 1.5);
            this.orbitAngle = this.launchStartAngle + angularVelocity * (this.launchDuration * 0.8) * turnFactor;

            const drdt = (safeR - pRad - 2.0) * (Math.PI / (2 * this.launchDuration)) * Math.cos(p * Math.PI / 2);
            const dthetadt = angularVelocity * 1.2 * Math.sqrt(p);

            this.x = planet.x + Math.cos(this.orbitAngle) * currentR;
            this.y = planet.y + Math.sin(this.orbitAngle) * currentR;

            this.vx = drdt * Math.cos(this.orbitAngle) - currentR * Math.sin(this.orbitAngle) * dthetadt;
            this.vy = drdt * Math.sin(this.orbitAngle) + currentR * Math.cos(this.orbitAngle) * dthetadt;

            this.heading = Math.atan2(this.vy, this.vx);
            this.thrustRatio = Math.max(0, 1.0 - Math.pow(p, 4));

            if (p >= 1.0) {
                this.thrustRatio = 0;
                this.state = this.postLaunchState;
                this.orbitTimer = 0;
            }
            return;
        }

        // 2. Orbit & Combat
        if (this.state === 'orbit') {
            const planet = this.targetPlanet;
            if (!planet) return;

            const safeR = Math.max(1, this.targetOrbitRadius);
            const vCirc = Math.sqrt(this.gravConst / safeR);
            const angularVelocity = (vCirc / safeR) * this.orbitDir;

            this.orbitTimer += dt;
            this.orbitAngle += angularVelocity * dt;
            this.x = planet.x + Math.cos(this.orbitAngle) * safeR;
            this.y = planet.y + Math.sin(this.orbitAngle) * safeR;

            this.vx = -Math.sin(this.orbitAngle) * vCirc * this.orbitDir;
            this.vy = Math.cos(this.orbitAngle) * vCirc * this.orbitDir;
            this.thrustRatio = 0;

            const enemy = this.findNearestEnemy(gameManager, 90.0);
            if (enemy) {
                const aimHeading = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.rotateTowards(aimHeading, dt);
                let angleDiff = Math.abs(Math.atan2(Math.sin(aimHeading - this.heading), Math.cos(aimHeading - this.heading)));
                if (angleDiff < 0.4) {
                    this.fireLaser(enemy, gameManager);
                }
            } else {
                const velHeading = Math.atan2(this.vy, this.vx);
                this.rotateTowards(velHeading, dt);

                if (this.orbitTimer > 0.5) {
                    const isUnclaimed = (this.targetPlanet.owner === 0);
                    const isEnemyPlanet = (this.targetPlanet.owner !== 0 && this.targetPlanet.owner !== this.owner);
                    if (isUnclaimed || isEnemyPlanet) {
                        this.state = 'landing';
                        this.landingProgress = 0;
                    }
                }
            }
            return;
        }

        // 3. Retrograde Landing Touchdown
        if (this.state === 'landing') {
            const planet = this.targetPlanet;
            if (!planet) return;

            this.landingProgress += dt / this.landingDuration;
            const p = Math.min(1.0, this.landingProgress);

            const safeR = Math.max(1, this.targetOrbitRadius);
            const vCirc = Math.sqrt(this.gravConst / safeR);
            const omegaCirc = (vCirc / safeR) * this.orbitDir;

            const pRad = planet.radius || 28;
            const currentR = safeR - (safeR - pRad - 1.5) * Math.sin(p * Math.PI / 2);
            const dthetadt = omegaCirc * (1.0 - p * 0.7);
            this.orbitAngle += dthetadt * dt;

            this.x = planet.x + Math.cos(this.orbitAngle) * currentR;
            this.y = planet.y + Math.sin(this.orbitAngle) * currentR;

            const drdt = -(safeR - pRad - 1.5) * (Math.PI / (2 * this.landingDuration)) * Math.cos(p * Math.PI / 2);
            this.vx = drdt * Math.cos(this.orbitAngle) - currentR * Math.sin(this.orbitAngle) * dthetadt;
            this.vy = drdt * Math.sin(this.orbitAngle) + currentR * Math.cos(this.orbitAngle) * dthetadt;

            const retroHeading = Math.atan2(-this.vy, -this.vx);
            const skywardHeading = Math.atan2(this.y - planet.y, this.x - planet.x);

            let diff = skywardHeading - retroHeading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.heading = retroHeading + diff * Math.pow(p, 0.8);

            this.thrustRatio = Math.sin(p * Math.PI) * 0.85;

            if (p >= 1.0) {
                this.dead = true;
                if (planet && typeof planet.onShipTouchdown === 'function') {
                    planet.onShipTouchdown(this, gameManager);
                }
                if (gameManager && typeof gameManager.destroyShip === 'function') {
                    gameManager.destroyShip(this);
                }
            }
            return;
        }

        // 4. Transit Movement & Flyby Navigation
        let totalFx = 0;
        let totalFy = 0;

        const refPlanet = this.orbitPlanet || this.targetPlanet;
        if (!refPlanet) return;

        const dx = this.x - refPlanet.x;
        const dy = this.y - refPlanet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const safeDist = Math.max(0.001, dist);

        const rx = dx / safeDist;
        const ry = dy / safeDist;

        const angularMomentum = dx * this.vy - dy * this.vx;
        if (Math.abs(angularMomentum) > 0.1) {
            this.orbitDir = angularMomentum >= 0 ? 1 : -1;
        }

        const tx = -ry * this.orbitDir;
        const ty = rx * this.orbitDir;

        // Gravity pull from current reference planet
        if (safeDist > 1.0) {
            const gAccel = this.gravConst / (safeDist * safeDist);
            totalFx -= rx * gAccel;
            totalFy -= ry * gAccel;
        }

        let desiredVx = 0;
        let desiredVy = 0;
        let requiresThrust = false;

        const transitEnemy = this.findNearestEnemy(gameManager, 85.0);
        if (transitEnemy) this.fireLaser(transitEnemy, gameManager);

        if (this.state === 'launching') {
            const vCirc = Math.sqrt(this.gravConst / safeDist);
            desiredVx = tx * vCirc;
            desiredVy = ty * vCirc;
            requiresThrust = true;

            const targetDx = this.targetPlanet.x - this.x;
            const targetDy = this.targetPlanet.y - this.y;
            const targetDist = Math.max(0.001, Math.sqrt(targetDx * targetDx + targetDy * targetDy));
            const alignment = tx * (targetDx / targetDist) + ty * (targetDy / targetDist);

            if (alignment >= 0.88) {
                this.state = 'moving';
                this.orbitPlanet = null;
            }
        } else if (this.state === 'moving') {
            const planets = (gameManager && Array.isArray(gameManager.planets)) ? gameManager.planets : null;

            // Detect blocking obstacle along direct path
            if (!this.flybyPlanet && planets) {
                const obstacle = findBlockingPlanet(this, this.targetPlanet, planets, [this.orbitPlanet, this.targetPlanet, this.lastFlybyPlanet]);
                if (obstacle) {
                    this.flybyPlanet = obstacle;
                    this.flybyTimer = 0;

                    // Pick offset side (-1 or +1) based on cross product
                    const tdx = this.targetPlanet.x - this.x;
                    const tdy = this.targetPlanet.y - this.y;
                    const pdx = obstacle.x - this.x;
                    const pdy = obstacle.y - this.y;
                    const cross = tdx * pdy - tdy * pdx;
                    this.flybySide = cross >= 0 ? -1 : 1;
                }
            }

            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const safeR = Math.max(1, this.targetOrbitRadius);
            const vCirc = Math.sqrt(this.gravConst / safeR);

            // Check if near final target destination for orbital insertion
            const decelDist = Math.max(16.0, (currentSpeed * currentSpeed - vCirc * vCirc) / (2.0 * this.enginePower)) + 20.0;
            const pdx = this.targetPlanet.x - this.x;
            const pdy = this.targetPlanet.y - this.y;
            const distToPlanet = Math.sqrt(pdx * pdx + pdy * pdy);

            if (distToPlanet <= safeR + decelDist && !this.flybyPlanet) {
                this.state = 'insertion';
                this.orbitPlanet = this.targetPlanet;
            }

            // --- Flyby Waypoint Navigation ---
            if (this.flybyPlanet) {
                this.flybyTimer += dt;

                const tdx = this.targetPlanet.x - this.x;
                const tdy = this.targetPlanet.y - this.y;
                const tDist = Math.max(0.001, Math.sqrt(tdx * tdx + tdy * tdy));
                const tUx = tdx / tDist;
                const tUy = tdy / tDist;

                // Perpendicular vector to line of flight
                const nx = -tUy;
                const ny = tUx;

                const safeRadius = (this.flybyPlanet.radius || 28) + 26;
                const wayX = this.flybyPlanet.x + nx * this.flybySide * safeRadius;
                const wayY = this.flybyPlanet.y + ny * this.flybySide * safeRadius;

                const wdx = wayX - this.x;
                const wdy = wayY - this.y;
                const wDist = Math.max(0.001, Math.sqrt(wdx * wdx + wdy * wdy));

                desiredVx = (wdx / wDist) * this.maxSpeed;
                desiredVy = (wdy / wDist) * this.maxSpeed;
                requiresThrust = true;

                // Release condition:
                // 1) Target planet has clear Line of Sight AND flyby planet center is no longer ahead
                // OR 2) Safety timeout hit (3.0s)
                const fdx = this.flybyPlanet.x - this.x;
                const fdy = this.flybyPlanet.y - this.y;
                const dotAhead = fdx * tUx + fdy * tUy; // Projection along target vector

                const clearLoS = hasLineOfSight(this, this.targetPlanet, planets);

                if ((clearLoS && dotAhead < 10.0) || this.flybyTimer > 3.0) {
                    this.lastFlybyPlanet = this.flybyPlanet;
                    this.flybyPlanet = null;
                    this.flybyTimer = 0;
                }
            } else {
                // Normal direct flight path to target planet
                const angleToShip = Math.atan2(this.y - this.targetPlanet.y, this.x - this.targetPlanet.x);
                const tangentAngle = angleToShip + (this.orbitDir * Math.PI / 2);

                const aimX = this.targetPlanet.x + Math.cos(tangentAngle) * safeR;
                const aimY = this.targetPlanet.y + Math.sin(tangentAngle) * safeR;

                const aimDx = aimX - this.x;
                const aimDy = aimY - this.y;
                const aimDist = Math.max(0.001, Math.sqrt(aimDx * aimDx + aimDy * aimDy));

                if (gameManager && gameManager.ships) {
                    this.computeBoidForces(gameManager.ships);
                }

                desiredVx = (aimDx / aimDist) * this.maxSpeed + this.boidFx;
                desiredVy = (aimDy / aimDist) * this.maxSpeed + this.boidFy;
                requiresThrust = true;
            }
        } else if (this.state === 'insertion') {
            const planet = this.orbitPlanet || this.targetPlanet;
            const dxPos = this.x - planet.x;
            const dyPos = this.y - planet.y;
            const currentDist = Math.max(0.001, Math.sqrt(dxPos * dxPos + dyPos * dyPos));

            const rxPos = dxPos / currentDist;
            const ryPos = dyPos / currentDist;

            const txPos = -ryPos * this.orbitDir;
            const tyPos = rxPos * this.orbitDir;

            const safeR = Math.max(1, this.targetOrbitRadius);
            const vCirc = Math.sqrt(this.gravConst / safeR);

            const radialError = currentDist - safeR;
            const desiredVr = -Math.sign(radialError) * Math.min(25.0, Math.abs(radialError) * 1.8);

            desiredVx = rxPos * desiredVr + txPos * vCirc;
            desiredVy = ryPos * desiredVr + tyPos * vCirc;
            requiresThrust = true;

            const vr = this.vx * rxPos + this.vy * ryPos;
            const vt = this.vx * txPos + this.vy * tyPos;

            if (Math.abs(radialError) < 3.0 && Math.abs(vr) < 3.0 && Math.abs(vt - vCirc) < 4.0) {
                this.orbitAngle = Math.atan2(dyPos, dxPos);
                this.state = 'orbit';
                this.orbitTimer = 0;
            }
        }

        if (requiresThrust) {
            const errVx = desiredVx - this.vx;
            const errVy = desiredVy - this.vy;
            const errMag = Math.sqrt(errVx * errVx + errVy * errVy);

            if (errMag > 0.5) {
                const targetHeading = Math.atan2(errVy, errVx);
                const aligned = this.rotateTowards(targetHeading, dt);

                if (aligned) {
                    this.thrustRatio = Math.min(1.0, errMag / 20.0);
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
        const speedCap = this.state === 'moving' ? this.maxSpeed * 1.25 : this.maxSpeed;
        if (currentSpeed > speedCap && currentSpeed > 0) {
            this.vx = (this.vx / currentSpeed) * speedCap;
            this.vy = (this.vy / currentSpeed) * speedCap;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        if (this.dead || isNaN(this.x) || isNaN(this.y)) return;

        if (this.laserTimer > 0 && this.laserTarget) {
            ctx.save();
            ctx.strokeStyle = (typeof OWNER_COLORS !== 'undefined' && OWNER_COLORS[this.owner]) ? OWNER_COLORS[this.owner] : '#ff4444';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(this.heading) * 3.5, this.y + Math.sin(this.heading) * 3.5);
            ctx.lineTo(this.laserTarget.x, this.laserTarget.y);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.heading);

        ctx.fillStyle = (typeof OWNER_COLORS !== 'undefined' && OWNER_COLORS[this.owner]) ? OWNER_COLORS[this.owner] : '#ffffff';
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
        if (this.dead || this.thrustRatio <= 0.05 || isNaN(this.x) || isNaN(this.y)) return;

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