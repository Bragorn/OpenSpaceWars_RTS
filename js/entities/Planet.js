class Planet {
    static DEFAULT_TIER_STATS = {
        1: { radius: 30, maxHP: 10, spawnInterval: 3.0, upgradeCost: 10 },
        2: { radius: 30, maxHP: 20, spawnInterval: 1.8, upgradeCost: 20 },
        3: { radius: 30, maxHP: 30, spawnInterval: 0.9, upgradeCost: 0 }
    };
    static FALLBACK_STATS = { radius: 28, maxHP: 20, spawnInterval: 3.0, upgradeCost: 10 };

    static CLAIM_COST = 5;          // ships needed to claim a neutral planet
    static NEUTRAL_START_HP = 5;
    static REGEN_INTERVAL = 3.0;    // seconds per +1 HP while damaged
    static TOUCHDOWN_POWER = 1.0;   // progress/damage per landed ship
    static MAX_TIER_CAP = 3;

    constructor(x, y, level = 1, owner = 0, customTierStats = null) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.owner = owner;
        this.tierStats = customTierStats || Planet.DEFAULT_TIER_STATS;

        const keys = Object.keys(this.tierStats).map(Number).filter(k => !isNaN(k));
        this.maxTier = keys.length > 0 ? Math.min(Planet.MAX_TIER_CAP, Math.max(...keys)) : Planet.MAX_TIER_CAP;

        const stats = this.statsFor(level);
        this.radius = stats.radius || 28;
        this.maxHp = stats.maxHP || 20;
        this.hp = owner !== 0 ? this.maxHp : Planet.NEUTRAL_START_HP;
        this.claimCost = Planet.CLAIM_COST;

        this.spawnTimer = 0;
        this.regenTimer = 0;
        this.upgradeProgress = 0;
        this.claimOwner = 0; // team currently leading the claim on a neutral planet
    }

    // ================= STATS =================

    statsFor(level) {
        return this.tierStats[level] || Planet.FALLBACK_STATS;
    }

    getMaxTier() {
        return this.maxTier;
    }

    getUpgradeCost() {
        return this.statsFor(this.level).upgradeCost || 10;
    }

    getOrbitingShipsCount(gameManager) {
        if (!gameManager || !gameManager.frameStats) return 0;
        return gameManager.frameStats.orbiting.get(this) || 0;
    }

    // ================= UPGRADES & CAPTURE =================

    // Sends orbiting ships down to feed the upgrade (random ships, as many as are still needed)
    startUpgrade(ships) {
        if (!ships || !Array.isArray(ships)) return;

        const upgCost = this.getUpgradeCost();
        if (this.level >= this.maxTier || upgCost <= 0) return;

        const mine = ships.filter(s => s && !s.dead && s.owner === this.owner && s.targetPlanet === this);
        const landingCount = mine.filter(s => s.state === 'landing').length;
        const needed = upgCost - (Math.floor(this.upgradeProgress) + landingCount);
        if (needed <= 0) return;

        const eligible = mine.filter(s => s.state === 'orbit');
        if (eligible.length === 0) return;

        for (let i = eligible.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
        }

        for (const ship of eligible.slice(0, needed)) {
            ship.targetPlanet = this;
            ship.state = 'landing';
            ship.landingProgress = 0;
        }
    }

    onShipTouchdown(ship, gameManager) {
        if (!ship) return;
        const power = Planet.TOUCHDOWN_POWER;

        if (this.owner === 0) {
            // Neutral: tug-of-war claim
            if (this.claimOwner === 0) this.claimOwner = ship.owner;

            if (ship.owner === this.claimOwner) {
                this.upgradeProgress += power;
                if (this.upgradeProgress >= this.claimCost) {
                    this.captureBy(ship.owner, gameManager);
                }
            } else {
                this.upgradeProgress -= power;
                if (this.upgradeProgress <= 0) {
                    this.upgradeProgress = 0;
                    this.claimOwner = 0;
                }
            }
        } else if (this.owner === ship.owner) {
            // Friendly: feed the upgrade
            if (this.level < this.maxTier) {
                this.upgradeProgress += power;
                if (this.upgradeProgress >= this.getUpgradeCost()) {
                    this.upgrade(gameManager);
                }
            }
        } else {
            // Enemy: damage it
            this.hp -= power;
            if (this.hp <= 0) {
                this.captureBy(ship.owner, gameManager);
            }
        }
    }

    captureBy(newOwner, gameManager) {
        this.owner = newOwner;
        this.level = 1;
        this.maxHp = this.statsFor(1).maxHP || 20;
        this.hp = this.maxHp;
        this.upgradeProgress = 0;
        this.claimOwner = 0;

        if (gameManager) {
            if (gameManager.telemetry) {
                gameManager.telemetry.logEvent(gameManager.gameTime, 'PLANET_CAPTURE', newOwner);
            }
            gameManager.playSound('planet_capture');
        }
    }

    upgrade(gameManager = null) {
        if (this.level >= this.maxTier) return;

        this.level++;
        this.maxHp = this.statsFor(this.level).maxHP || (this.maxHp + 10);
        this.hp = this.maxHp;
        this.upgradeProgress = 0;

        if (gameManager && gameManager.telemetry) {
            gameManager.telemetry.logEvent(gameManager.gameTime, 'PLANET_UPGRADE', this.owner);
        }
        if (gameManager) gameManager.playSound('planet_upgrade');
    }

    // ================= UPDATE =================

    update(dtUncapped, gameManager) {
        const dt = Math.min(dtUncapped || 0.016, 0.1);

        if ((this.owner === 0 || this.hp < this.maxHp) && gameManager && gameManager.telemetry) {
            gameManager.telemetry.addContestedTime(dt);
        }

        if (this.owner !== 0) {
            this.updateSpawning(dt, gameManager);
            this.updateRegen(dt);
        }
    }

    updateSpawning(dt, gameManager) {
        this.spawnTimer += dt;

        const faction = FactionManager.getFaction(this.owner, gameManager);
        const interval = this.statsFor(this.level).spawnInterval * (faction.spawnIntervalMult || 1.0);

        if (this.spawnTimer >= interval) {
            this.spawnTimer = 0;
            if (gameManager && typeof gameManager.spawnShip === 'function') {
                gameManager.spawnShip(this, this);
            }
        }
    }

    updateRegen(dt) {
        if (this.hp >= this.maxHp) {
            this.regenTimer = 0;
            return;
        }
        this.regenTimer += dt;
        if (this.regenTimer >= Planet.REGEN_INTERVAL) {
            this.regenTimer = 0;
            this.hp = Math.min(this.maxHp, this.hp + 1);
        }
    }
}