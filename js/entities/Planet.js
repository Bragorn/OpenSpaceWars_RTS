class Planet {
    static DEFAULT_TIER_STATS = {
        1: { radius: 30, maxHP: 10, spawnInterval: 3.0, upgradeCost: 10 },
        2: { radius: 30, maxHP: 20, spawnInterval: 1.8, upgradeCost: 20 },
        3: { radius: 30, maxHP: 30, spawnInterval: 0.9, upgradeCost: 0 }
    };

    static CLAIM_COST = 5;          // ships needed to claim a neutral planet
    static NEUTRAL_START_HP = 5;
    static REGEN_INTERVAL = 3.0;    // seconds per +1 HP while damaged
    static TOUCHDOWN_POWER = 1.0;   // progress/damage per landed ship
    static MAX_TIER_CAP = 3;

    // gameManager is needed so owned planets can read their faction's planetHpMult
    constructor(x, y, level = 1, owner = 0, gameManager = null) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.owner = owner;
        this.costMult = (owner !== 0 && gameManager) ? FactionManager.getFaction(owner, gameManager).upgradeCostMult : 1;
        this.tierStats = Planet.DEFAULT_TIER_STATS;

        this.maxTier = Math.min(Planet.MAX_TIER_CAP, Math.max(...Object.keys(this.tierStats).map(Number)));

        const stats = this.statsFor(level);
        this.radius = stats.radius;
        this.maxHp = this.tierHp(level, gameManager);
        this.hp = owner !== 0 ? this.maxHp : Planet.NEUTRAL_START_HP;
        this.claimCost = Planet.CLAIM_COST;

        this.spawnTimer = 0;
        this.regenTimer = 0;
        this.upgradeProgress = 0;
        this.claimOwner = 0; // team currently leading the claim on a neutral planet
    }

    // ================= STATS =================

    statsFor(level) {
        return this.tierStats[level];
    }

    // Tier HP times the owner's planetHpMult (neutral planets use the plain tier value)
    tierHp(level, gameManager) {
        const base = this.statsFor(level).maxHP;
        if (this.owner === 0 || !gameManager) return base;
        const mult = FactionManager.getFaction(this.owner, gameManager).planetHpMult;
        return Math.max(1, Math.round(base * mult));
    }

    getMaxTier() {
        return this.maxTier;
    }

    getUpgradeCost() {
        return Math.round(this.statsFor(this.level).upgradeCost * this.costMult);
    }

    getOrbitingShipsCount(gameManager) {
        return gameManager.frameStats.orbiting.get(this) || 0;
    }

    // ================= UPGRADES & CAPTURE =================

    // Sends orbiting ships down to feed the upgrade (random ships, as many as are still needed).
    // maxCount (optional) caps how many are sent this call.
    startUpgrade(ships, maxCount = Infinity) {
        const upgCost = this.getUpgradeCost();
        if (this.level >= this.maxTier || upgCost <= 0) return;

        const mine = ships.filter(s => !s.dead && s.owner === this.owner && s.targetPlanet === this);
        const landingCount = mine.filter(s => s.state === 'landing').length;
        const needed = Math.min(maxCount, upgCost - (Math.floor(this.upgradeProgress) + landingCount));
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
        this.costMult = FactionManager.getFaction(newOwner, gameManager).upgradeCostMult;
        this.level = 1;
        this.maxHp = this.tierHp(1, gameManager);
        this.hp = this.maxHp;
        this.upgradeProgress = 0;
        this.claimOwner = 0;

        gameManager.log('PLANET_CAPTURE', newOwner);
        gameManager.playSound('planet_capture');
    }

    upgrade(gameManager) {
        if (this.level >= this.maxTier) return;

        this.level++;
        this.maxHp = this.tierHp(this.level, gameManager);
        this.hp = this.maxHp;
        this.upgradeProgress = 0;

        gameManager.log('PLANET_UPGRADE', this.owner);
        gameManager.playSound('planet_upgrade');
    }

    // ================= UPDATE =================

    update(dt, gameManager) {
        if (this.owner !== 0) {
            this.updateSpawning(dt, gameManager);
            this.updateRegen(dt);
        }
    }

    updateSpawning(dt, gameManager) {
        this.spawnTimer += dt;

        const faction = FactionManager.getFaction(this.owner, gameManager);
        const interval = this.statsFor(this.level).spawnInterval * faction.spawnIntervalMult;

        if (this.spawnTimer >= interval) {
            this.spawnTimer = 0;
            gameManager.spawnShip(this, this);
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