const TRANSIT_SOI_RADIUS = window.GAME_CONFIG.PHYSICS.SOI_RADIUS;

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
        const blockRadius = (planet.radius) + 2;

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
        this.laserRange = faction.laserRange;
        this.maxSpeed = faction.maxSpeed;
        this.enginePower = faction.enginePower;
        this.transitTurnRate = faction.transitTurnRate;
        this.combatTurnRate = faction.combatTurnRate;

        const baseRadius = sourcePlanet.radius;
        const spawnAngle = Math.random() * Math.PI * 2;
        const minOrbitOffset = 14;
        const maxOrbitSpread = 14;
        this.targetOrbitRadius = baseRadius + minOrbitOffset + Math.random() * maxOrbitSpread;

        this.gravConst = window.GAME_CONFIG.PHYSICS.GRAV_CONST;
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
        this.landingDuration = 4.0;
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
        this.hasEngagedCombat = false;

        // Transit state (burn-based transfers)
        this.originPlanet = null;
        this.burning = false;
        this.burnSpeed = 0;
        this.departTpl = null;
    }

    // ================= HELPERS =================

    // Gravity from a planet, but only inside its sphere of influence
    addSOIGravity(planet, force) {
        if (!planet) return;
        const dx = planet.x - this.x;
        const dy = planet.y - this.y;
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const d = Math.sqrt(d2);
        if (d >= TRANSIT_SOI_RADIUS) return;
        const a = this.gravConst / d2;
        force.x += (dx / d) * a;
        force.y += (dy / d) * a;
    }

    get currentTurnRate() {
        return (this.state === 'insertion' || this.state === 'orbit') ? this.combatTurnRate : this.transitTurnRate;
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

    // ================= COMBAT =================

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
            if (gameManager) gameManager.spawnExplosion(this.x, this.y);

            if (gameManager && gameManager.telemetry) {
                gameManager.telemetry.logEvent(gameManager.gameTime, 'SHIP_DESTROYED', this.owner);
                if (attackerOwner && attackerOwner !== this.owner) {
                    gameManager.telemetry.logEvent(gameManager.gameTime, 'SHIP_KILLED', attackerOwner);
                }
            }
        }
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
            if (gameManager) gameManager.playSound('laser', { x: this.x });
            this.laserTarget = { x: target.x, y: target.y };
            this.laserTimer = 0.08;
            this.shootCooldown = this.laserCooldownMax + Math.random() * 0.2;
        }
    }

    // ================= UPDATE =================

    update(dtUncapped, gameManager) {
        if (this.dead) return;

        const dt = Math.min(dtUncapped || 0.016, 0.1);

        if (this.laserTimer > 0) this.laserTimer -= dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        switch (this.state) {
            case 'surface_launch': this.updateSurfaceLaunch(dt); break;
            case 'orbit':          this.updateOrbit(dt, gameManager); break;
            case 'landing':        this.updateLanding(dt, gameManager); break;
            default:               this.updateTransit(dt, gameManager); break; // launching, moving, insertion
        }
    }

    // 1. Lifting off the surface into a parking orbit
    updateSurfaceLaunch(dt) {
        const planet = this.orbitPlanet || this.targetPlanet;
        if (!planet) return;

        this.launchProgress += dt / this.launchDuration;
        const p = Math.min(1.0, this.launchProgress);

        const safeR = Math.max(1, this.targetOrbitRadius);
        const vCirc = Math.sqrt(this.gravConst / safeR);
        const omegaBase = vCirc / safeR;
        const angularVelocity = omegaBase * this.orbitDir;

        const pRad = planet.radius;
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
    }

    // 2. Circling a planet, fighting, and deciding when to land
    updateOrbit(dt, gameManager) {
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
            const angleDiff = Math.abs(Math.atan2(Math.sin(aimHeading - this.heading), Math.cos(aimHeading - this.heading)));
            if (angleDiff < 0.4) {
                this.fireLaser(enemy, gameManager);
            }
            return;
        }

        this.rotateTowards(Math.atan2(this.vy, this.vx), dt);

        if (this.orbitTimer > 0.5) {
            const isUnclaimed = (planet.owner === 0);
            const isEnemyPlanet = (planet.owner !== 0 && planet.owner !== this.owner);
            const maxTier = planet.getMaxTier();
            const isFriendlyUpgradeable = (planet.owner === this.owner && planet.level < maxTier && this.orbitPlanet !== planet);

            if (isUnclaimed || isEnemyPlanet || isFriendlyUpgradeable) {
                this.state = 'landing';
                this.landingProgress = 0;
            }
        }
    }

    // 3. Descending to the surface; the ship is consumed on touchdown
    updateLanding(dt, gameManager) {
        const planet = this.targetPlanet;
        if (!planet) return;

        this.landingProgress += dt / this.landingDuration;
        const p = Math.min(1.0, this.landingProgress);

        const safeR = Math.max(1, this.targetOrbitRadius);
        const vCirc = Math.sqrt(this.gravConst / safeR);
        const omegaCirc = (vCirc / safeR) * this.orbitDir;

        const pRad = planet.radius;
        const dropDist = safeR - pRad - 1.5;
        const DESCENT_CURVE = 2.0;  // higher = gentler start, steeper finish
        const SLIDE_FADE = 2.0;     // higher = sideways drift dies off sooner

        // Radius: slow at first, then accelerating straight down
        const currentR = safeR - dropDist * Math.pow(p, DESCENT_CURVE);
        const drdt = -dropDist * DESCENT_CURVE * Math.pow(p, DESCENT_CURVE - 1) / this.landingDuration;

        // Sideways drift fades to zero at touchdown
        const dthetadt = omegaCirc * Math.pow(1.0 - p, SLIDE_FADE);
        this.orbitAngle += dthetadt * dt;

        this.x = planet.x + Math.cos(this.orbitAngle) * currentR;
        this.y = planet.y + Math.sin(this.orbitAngle) * currentR;

        this.vx = drdt * Math.cos(this.orbitAngle) - currentR * Math.sin(this.orbitAngle) * dthetadt;
        this.vy = drdt * Math.sin(this.orbitAngle) + currentR * Math.cos(this.orbitAngle) * dthetadt;

        // Always point retrograde. As the velocity turns vertical, the nose ends up
        // pointing straight up, so there's no separate rotation to fight the motion.
        this.rotateTowards(Math.atan2(-this.vy, -this.vx), dt);

        this.thrustRatio = Math.sin(p * Math.PI) * 0.85;

        if (p >= 1.0) {
            this.dead = true;
            if (gameManager && gameManager.telemetry && !this.hasEngagedCombat) {
                this.hasEngagedCombat = true;
                gameManager.telemetry.logEvent(gameManager.gameTime, 'COMBAT_PARTICIPANT', this.owner);
            }
            planet.onShipTouchdown(this, gameManager);
        }
    }

    // 4. Transit: departure burn, straight coast, capture burn
    //    (planets only pull inside their sphere of influence)
    updateTransit(dt, gameManager) {
        const target = this.targetPlanet;
        if (!target) return;

        const transitEnemy = this.findNearestEnemy(gameManager, this.laserRange);
        if (transitEnemy) this.fireLaser(transitEnemy, gameManager);

        const R = TRANSIT_SOI_RADIUS;
        const mu = this.gravConst;
        const simStep = window.GAME_CONFIG.SIM_STEP;
        const force = { x: 0, y: 0 };
        this.thrustRatio = 0;

        // Departure plan, built once per trip
        if (this.state === 'launching' && !this.departTpl && this.orbitPlanet) {
            this.targetOrbitRadius = Math.max(1, Math.round(this.targetOrbitRadius * 2) / 2);
            this.departTpl = OrbitalMath.departureTemplate(
                this.targetOrbitRadius, this.orbitDir, mu, R, this.enginePower, this.maxSpeed, simStep);
            if (!this.departTpl) {
                this.state = 'orbit';
                this.targetPlanet = this.orbitPlanet;
                return;
            }
        }
        const tpl = this.departTpl;
        const safeR = Math.max(1, this.targetOrbitRadius);
        const vCirc = Math.sqrt(mu / safeR);

        // Gravity: only the planets whose SOI we are inside
        this.addSOIGravity(this.orbitPlanet, force);
        if (this.originPlanet && this.originPlanet !== this.orbitPlanet) this.addSOIGravity(this.originPlanet, force);
        if (target !== this.orbitPlanet) this.addSOIGravity(target, force);

        if (this.state === 'launching') {
            // Returns false when the ship was placed directly (no physics step this tick)
            if (!this.stepLaunching(dt, force, tpl, target, safeR, vCirc)) return;
        } else if (this.state === 'moving') {
            this.stepMoving(dt, tpl, target);
        } else if (this.state === 'insertion') {
            this.stepInsertion(dt, force, target, mu);
        }

        this.integrateMotion(dt, force);
    }

    stepLaunching(dt, force, tpl, target, safeR, vCirc) {
        const planet = this.orbitPlanet;
        if (!planet || !tpl) return false;

        const dx = this.x - planet.x;
        const dy = this.y - planet.y;
        const r = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const s = this.orbitDir;

        if (!this.burning) {
            // Parking orbit (on rails) until the departure window opens
            const angPrev = Math.atan2(dy, dx);
            let ang = angPrev + (vCirc / safeR) * s * dt;
            const rNew = r + (safeR - r) * Math.min(1, dt * 4);

            // Window: the orbit position whose pre-simulated escape leaves along
            // a line through the midpoint between the planets (the S-curve)
            const abx = target.x - planet.x;
            const aby = target.y - planet.y;
            const D = Math.max(1, Math.sqrt(abx * abx + aby * aby));
            const alpha = Math.asin(Math.min(1, (2 * tpl.h) / D));
            const exitDir = Math.atan2(aby, abx) + s * alpha;
            const startAng = exitDir - Math.atan2(tpl.dirY, tpl.dirX);

            const dPrev = s * Math.atan2(Math.sin(angPrev - startAng), Math.cos(angPrev - startAng));
            const dNew = s * Math.atan2(Math.sin(ang - startAng), Math.cos(ang - startAng));
            const crossing = dPrev < 0 && dNew >= 0 && dNew < 0.5 && Math.abs(rNew - safeR) < 0.05;
            if (crossing) ang = startAng;

            const rr = crossing ? safeR : rNew;
            this.orbitAngle = ang;
            this.x = planet.x + Math.cos(ang) * rr;
            this.y = planet.y + Math.sin(ang) * rr;
            this.vx = -Math.sin(ang) * vCirc * s;
            this.vy = Math.cos(ang) * vCirc * s;
            this.heading = Math.atan2(this.vy, this.vx);

            if (crossing) {
                this.burning = true;
                this.burnSpeed = tpl.vStop;
            }
            return false;
        }

        // Prograde departure burn, heading locked to velocity
        const speed = Math.max(0.001, Math.sqrt(this.vx * this.vx + this.vy * this.vy));
        if (speed >= this.burnSpeed) {
            this.burning = false;
            this.originPlanet = planet;
            this.orbitPlanet = null;
            this.state = 'moving';
        } else {
            this.heading = Math.atan2(this.vy, this.vx);
            this.thrustRatio = 1;
            force.x += (this.vx / speed) * this.enginePower;
            force.y += (this.vy / speed) * this.enginePower;
        }
        return true;
    }

    // Straight coast. Inside the target's SOI, face retrograde and wait for the capture point.
    stepMoving(dt, tpl, target) {
        const R = TRANSIT_SOI_RADIUS;
        const tdx = target.x - this.x;
        const tdy = target.y - this.y;
        const dT = Math.max(0.001, Math.sqrt(tdx * tdx + tdy * tdy));

        if (dT < R) {
            this.rotateTowards(Math.atan2(-this.vy, -this.vx), dt);
            const vr = -(tdx * this.vx + tdy * this.vy) / dT; // > 0 means moving away
            if (tpl && (dT <= tpl.rb || vr >= 0)) {
                this.state = 'insertion';
                this.orbitPlanet = target;
                this.burning = true;
            }
        } else {
            // Outside the SOI: swing retrograde early enough to be facing back when the burn starts
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const flipAt = tpl ? tpl.rb + spd * (Math.PI / this.transitTurnRate) * 1.3 : R;
            const wantRetro = dT <= flipAt;
            this.rotateTowards(Math.atan2(wantRetro ? -this.vy : this.vy, wantRetro ? -this.vx : this.vx), dt);
        }
    }

    // Capture burn: the exit burn run backward, ending in a circular orbit
    stepInsertion(dt, force, target, mu) {
        const dxPos = this.x - target.x;
        const dyPos = this.y - target.y;
        const rr = Math.max(1, Math.sqrt(dxPos * dxPos + dyPos * dyPos));
        const speed = Math.max(0.001, Math.sqrt(this.vx * this.vx + this.vy * this.vy));

        if (speed > Math.sqrt(mu / rr)) {
            this.rotateTowards(Math.atan2(-this.vy, -this.vx), dt);
            this.thrustRatio = 1;
            force.x -= (this.vx / speed) * this.enginePower;
            force.y -= (this.vy / speed) * this.enginePower;
        } else {
            // Circular speed reached: settle in at this radius, in the sense we are travelling
            this.burning = false;
            this.departTpl = null;
            this.originPlanet = null;
            this.orbitDir = (dxPos * this.vy - dyPos * this.vx) >= 0 ? 1 : -1;
            this.targetOrbitRadius = Math.max(rr, target.radius + 14);
            this.orbitAngle = Math.atan2(dyPos, dxPos);
            this.state = 'orbit';
            this.orbitTimer = 0;
        }
    }

    integrateMotion(dt, force) {
        this.vx += (force.x / this.mass) * dt;
        this.vy += (force.y / this.mass) * dt;

        // Safety cap only
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const speedCap = this.maxSpeed * 3.0;
        if (currentSpeed > speedCap) {
            this.vx = (this.vx / currentSpeed) * speedCap;
            this.vy = (this.vy / currentSpeed) * speedCap;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
}