const TRANSIT_SOI_RADIUS = 110;

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
        const u = Math.max(0, Math.min(1, (pdx * dx + pdy * dy) / lineLenSq));

        const closestX = p1.x + u * dx;
        const closestY = p1.y + u * dy;
        const cdx = planet.x - closestX;
        const cdy = planet.y - closestY;
        const distSq = cdx * cdx + cdy * cdy;
        const blockRadius = (planet.radius || 28) + 2;

        if (distSq < blockRadius * blockRadius) {
            return false;
        }
    }
    return true;
}

class Ship {
    constructor(sourcePlanet, targetPlanet, gameManager) {
        this.owner = sourcePlanet ? sourcePlanet.owner : 0;
        this.orbitPlanet = sourcePlanet;
        this.targetPlanet = targetPlanet || sourcePlanet;

        const faction = FactionManager.getFaction(this.owner, gameManager);
        this.color = faction.color;
        this.hp = faction.hp;
        this.maxHp = faction.hp;
        this.laserDamage = faction.laserDamage;
        this.laserCooldownMax = faction.laserCooldown;
        this.laserRange = faction.laserRange || 90.0;
        this.maxSpeed = faction.maxSpeed;
        this.enginePower = faction.enginePower;
        this.transitTurnRate = faction.transitTurnRate;
        this.combatTurnRate = faction.combatTurnRate;

        this.touchdownPower = 1.0;

        const baseRadius = (sourcePlanet && sourcePlanet.radius) ? sourcePlanet.radius : 28;
        const spawnAngle = Math.random() * Math.PI * 2;
        const minOrbitOffset = 20;
        const maxOrbitSpread = 10;
        this.targetOrbitRadius = baseRadius + minOrbitOffset + Math.random() * maxOrbitSpread;

        this.gravConst = 12000.0;
        this.mass = 1.0;

        this.shootCooldown = Math.random() * 0.4;
        this.laserTarget = null;
        this.laserTimer = 0;

        this.orbitDir = Math.random() < 0.5 ? 1 : -1;
        this.launchStartAngle = spawnAngle; 
        this.orbitAngle = spawnAngle;

        this.launchProgress = 0;
        this.launchDuration = 2.0;
        this.landingProgress = 0;
        this.landingDuration = 3.0;
        this.orbitTimer = 0;

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
        this.hasEngagedCombat = false;

        // Transit state (burn-based transfers)
        this.originPlanet = null;
        this.burning = false;
        this.burnSpeed = 0;
        this.correcting = false;
        this.captured = false;
    }

    get currentTurnRate() {
        return (this.state === 'insertion' || this.state === 'orbit') ? this.combatTurnRate : this.transitTurnRate;
    }

    takeDamage(amount, gameManager, attackerOwner = null) {
        if (this.dead) return;

        this.hp -= amount;

        if (gameManager && gameManager.telemetry) {
            gameManager.telemetry.logEvent(gameManager.gameTime, 'DAMAGE_RECEIVED', this.owner, { amount });
            if (attackerOwner) {
                gameManager.telemetry.logEvent(gameManager.gameTime, 'DAMAGE_DEALT', attackerOwner, { amount });
            }
            if (!this.hasEngagedCombat) {
                this.hasEngagedCombat = true;
                gameManager.telemetry.logEvent(gameManager.gameTime, 'COMBAT_PARTICIPANT', this.owner);
            }
        }

        if (this.hp <= 0) {
            this.dead = true;

            if (gameManager) {
                if (gameManager.telemetry) {
                    gameManager.telemetry.logEvent(gameManager.gameTime, 'SHIP_DESTROYED', this.owner);
                    if (attackerOwner && attackerOwner !== this.owner) {
                        gameManager.telemetry.logEvent(gameManager.gameTime, 'SHIP_KILLED', attackerOwner);
                    }
                }
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

        let fx = sepX * 8.0;
        let fy = sepY * 8.0;
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

    findNearestEnemy(gameManager, maxRange = null) {
        if (isNaN(this.x) || isNaN(this.y)) return null;

        const effectiveRange = maxRange || this.laserRange;
        let nearestEnemy = null;
        let minDist = effectiveRange;
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

            if (gameManager && gameManager.telemetry && !this.hasEngagedCombat) {
                this.hasEngagedCombat = true;
                gameManager.telemetry.logEvent(gameManager.gameTime, 'COMBAT_PARTICIPANT', this.owner);
            }

            target.takeDamage(this.laserDamage, gameManager, this.owner);
            this.laserTarget = { x: target.x, y: target.y };
            this.laserTimer = 0.08;
            this.shootCooldown = this.laserCooldownMax + Math.random() * 0.2;
        }
    }

    // Aim point offset to one side of the target so the coast arrives with
    // periapsis at this ship's orbit radius (corrected for gravity bending).
    getAimPoint() {
        const t = this.targetPlanet;
        const dx = t.x - this.x;
        const dy = t.y - this.y;
        const d = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
        const r = Math.max(1, this.targetOrbitRadius);
        const v = this.maxSpeed;
        const b = r * Math.sqrt(1 + (2 * this.gravConst) / (r * v * v));
        return { x: t.x + (dy / d) * b * this.orbitDir, y: t.y - (dx / d) * b * this.orbitDir };
    }

    addGravity(planet, force) {
        const dx = planet.x - this.x;
        const dy = planet.y - this.y;
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const d = Math.sqrt(d2);
        const a = this.gravConst / d2;
        force.x += (dx / d) * a;
        force.y += (dy / d) * a;
    }

    // Turn toward a burn direction, fire only once pointed close enough
    burnAlong(dirX, dirY, dt, force, ratio = 1) {
        const aligned = this.rotateTowards(Math.atan2(dirY, dirX), dt);
        if (aligned) {
            this.thrustRatio = ratio;
            const accel = this.enginePower * ratio;
            force.x += Math.cos(this.heading) * accel;
            force.y += Math.sin(this.heading) * accel;
        }
    }

    // Proportional thrust toward a desired velocity (used to circularize)
    thrustToVelocity(desVx, desVy, dt, force) {
        const errVx = desVx - this.vx;
        const errVy = desVy - this.vy;
        const errMag = Math.sqrt(errVx * errVx + errVy * errVy);
        if (errMag <= 0.5) return;
        const aligned = this.rotateTowards(Math.atan2(errVy, errVx), dt);
        if (aligned) {
            const ratio = Math.min(1.0, errMag / 20.0);
            this.thrustRatio = ratio;
            force.x += Math.cos(this.heading) * this.enginePower * ratio;
            force.y += Math.sin(this.heading) * this.enginePower * ratio;
        }
    }

    update(dtUncapped, gameManager) {
        if (this.dead) return;

        const dt = Math.min(dtUncapped || 0.016, 0.1);

        if (this.laserTimer > 0) this.laserTimer -= dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

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

            const enemy = this.findNearestEnemy(gameManager, this.laserRange);
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
                    const maxTier = this.targetPlanet.getMaxTier ? this.targetPlanet.getMaxTier() : 3;
                    const isFriendlyUpgradeable = (this.targetPlanet.owner === this.owner && this.targetPlanet.level < maxTier && this.orbitPlanet !== this.targetPlanet);

                    if (isUnclaimed || isEnemyPlanet || isFriendlyUpgradeable) {
                        this.state = 'landing';
                        this.landingProgress = 0;
                    }
                }
            }
            return;
        }

        // 3. Landing Touchdown
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
                if (gameManager && gameManager.telemetry && !this.hasEngagedCombat) {
                    this.hasEngagedCombat = true;
                    gameManager.telemetry.logEvent(gameManager.gameTime, 'COMBAT_PARTICIPANT', this.owner);
                }
                if (planet && typeof planet.onShipTouchdown === 'function') {
                    planet.onShipTouchdown(this, gameManager);
                }
            }
            return;
        }

                // 4. Transit (burn-based transfers)
        const target = this.targetPlanet;
        if (!target) return;

        const transitEnemy = this.findNearestEnemy(gameManager, this.laserRange);
        if (transitEnemy) this.fireLaser(transitEnemy, gameManager);

        const mu = this.gravConst;
        const force = { x: 0, y: 0 };
        this.thrustRatio = 0;

        // Gravity from the planets that matter for this leg only
        const bodies = [];
        if (this.orbitPlanet) bodies.push(this.orbitPlanet);
        if (this.state !== 'launching') {
            if (this.originPlanet && !bodies.includes(this.originPlanet)) bodies.push(this.originPlanet);
            if (!bodies.includes(target)) bodies.push(target);
        }
        for (let i = 0; i < bodies.length; i++) this.addGravity(bodies[i], force);

        const safeR = Math.max(1, this.targetOrbitRadius);
        const vCirc = Math.sqrt(mu / safeR);
        const vInf = this.maxSpeed; // cruise speed

        if (this.state === 'launching') {
            const planet = this.orbitPlanet;
            if (!planet) return;
            const dx = this.x - planet.x;
            const dy = this.y - planet.y;
            const r = Math.max(1, Math.sqrt(dx * dx + dy * dy));

            if (!this.burning) {
                // Parking orbit (on rails) until the departure window opens
                const ang = Math.atan2(dy, dx) + (vCirc / safeR) * this.orbitDir * dt;
                const rNew = r + (safeR - r) * Math.min(1, dt * 4);
                this.orbitAngle = ang;
                this.x = planet.x + Math.cos(ang) * rNew;
                this.y = planet.y + Math.sin(ang) * rNew;
                this.vx = -Math.sin(ang) * vCirc * this.orbitDir;
                this.vy = Math.cos(ang) * vCirc * this.orbitDir;
                this.heading = Math.atan2(this.vy, this.vx);

                // Departure window: start the burn early enough that the
                // gravity-bent escape path points at the target
                const vDep = Math.sqrt(vInf * vInf + (2 * mu) / rNew);
                const burnTime = Math.max(0, (vDep - vCirc) / this.enginePower);
                const e = 1 + (rNew * vInf * vInf) / mu;
                const lead = Math.asin(1 / e) + 0.5 * burnTime * (vCirc / safeR);

                const aim = this.getAimPoint();
                const aimDir = Math.atan2(aim.y - this.y, aim.x - this.x);
                const velDir = Math.atan2(this.vy, this.vx);
                let err = velDir - (aimDir - lead * this.orbitDir);
                err = Math.atan2(Math.sin(err), Math.cos(err));

                if (Math.abs(err) < 0.1) {
                    this.burning = true;
                    this.burnSpeed = vDep;
                }
                return;
            }

            // Prograde departure burn until reaching departure speed
            const speed = Math.max(0.001, Math.sqrt(this.vx * this.vx + this.vy * this.vy));
            if (speed >= this.burnSpeed) {
                this.burning = false;
                this.originPlanet = planet;
                this.orbitPlanet = null;
                this.correcting = false;
                this.state = 'moving';
            } else {
                this.burnAlong(this.vx / speed, this.vy / speed, dt, force);
            }

        } else if (this.state === 'moving') {
            const tdx = target.x - this.x;
            const tdy = target.y - this.y;
            const dT = Math.max(0.001, Math.sqrt(tdx * tdx + tdy * tdy));
            const speed = Math.max(0.001, Math.sqrt(this.vx * this.vx + this.vy * this.vy));

            if (dT > TRANSIT_SOI_RADIUS) {
                // Coast; small mid-course corrections only if the path drifts
                const aim = this.getAimPoint();
                const adx = aim.x - this.x;
                const ady = aim.y - this.y;
                const aD = Math.max(0.001, Math.sqrt(adx * adx + ady * ady));
                const ux = adx / aD;
                const uy = ady / aD;
                const along = this.vx * ux + this.vy * uy;
                const latX = this.vx - along * ux;
                const latY = this.vy - along * uy;
                const latMag = Math.sqrt(latX * latX + latY * latY);
                const angErr = latMag / speed;

                if (!this.correcting && angErr > 0.05) this.correcting = true;
                else if (this.correcting && angErr < 0.01) this.correcting = false;

                if (this.correcting && latMag > 0.001) {
                    this.burnAlong(-latX / latMag, -latY / latMag, dt, force);
                } else {
                    this.rotateTowards(Math.atan2(this.vy, this.vx), dt);
                }
            } else {
                // Inside the target's sphere of influence: flip retrograde and
                // time the capture burn to be centered on closest approach
                this.correcting = false;
                this.rotateTowards(Math.atan2(-this.vy, -this.vx), dt);

                const track = Math.sqrt(Math.max(0, dT * dT - safeR * safeR));
                const rr = Math.max(dT, safeR);
                const vPeri = Math.sqrt(speed * speed + 2 * mu * (1 / safeR - 1 / rr));
                const burnT = Math.max(0, (vPeri - vCirc) / this.enginePower);
                const halfPath = 0.25 * (vPeri + vCirc) * burnT;

                if (track <= halfPath) {
                    this.state = 'insertion';
                    this.orbitPlanet = target;
                    this.captured = false;
                }
            }

        } else if (this.state === 'insertion') {
            const planet = target;
            const dxPos = this.x - planet.x;
            const dyPos = this.y - planet.y;
            const currentDist = Math.max(0.001, Math.sqrt(dxPos * dxPos + dyPos * dyPos));
            const rxPos = dxPos / currentDist;
            const ryPos = dyPos / currentDist;
            const txPos = -ryPos * this.orbitDir;
            const tyPos = rxPos * this.orbitDir;

            const vr = this.vx * rxPos + this.vy * ryPos;
            const vt = this.vx * txPos + this.vy * tyPos;
            const speed = Math.max(0.001, Math.sqrt(this.vx * this.vx + this.vy * this.vy));
            const vCircHere = Math.sqrt(mu / currentDist);

            if (!this.captured && speed > vCircHere * 1.05) {
                // Capture burn: retrograde until slower than circular speed here
                this.burnAlong(-this.vx / speed, -this.vy / speed, dt, force);
            } else {
                this.captured = true;
                // Circularize: ease radius and speed toward the parking orbit
                const radialError = currentDist - safeR;
                const desiredVr = -Math.sign(radialError) * Math.min(25.0, Math.abs(radialError) * 1.8);
                this.thrustToVelocity(
                    rxPos * desiredVr + txPos * vCirc,
                    ryPos * desiredVr + tyPos * vCirc,
                    dt, force
                );

                if (Math.abs(radialError) < 3.0 && Math.abs(vr) < 3.0 && Math.abs(vt - vCirc) < 4.0) {
                    this.orbitAngle = Math.atan2(dyPos, dxPos);
                    this.state = 'orbit';
                    this.orbitTimer = 0;
                }
            }
        }

        this.vx += (force.x / this.mass) * dt;
        this.vy += (force.y / this.mass) * dt;

        // Safety cap only; real speeds now come from the burns and gravity
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const speedCap = this.maxSpeed * 2.0;
        if (currentSpeed > speedCap) {
            this.vx = (this.vx / currentSpeed) * speedCap;
            this.vy = (this.vy / currentSpeed) * speedCap;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
}