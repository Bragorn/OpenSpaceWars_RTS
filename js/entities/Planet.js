class Planet {
    constructor(x, y, level = 1, owner = 0) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.owner = owner;

        const stats = (typeof TIER_STATS !== 'undefined' && TIER_STATS[level]) 
            ? TIER_STATS[level] 
            : { radius: 28, maxHP: 20 + level * 10, spawnInterval: 3, upgradeCost: 10 };

        this.radius = 28; 
        this.maxHp = stats.maxHP || 20;
        this.hp = owner !== 0 ? this.maxHp : 5;
        this.claimCost = 5;
        this.spawnTimer = 0;
        this.regenTimer = 0;

        this.upgradeProgress = 0;
        this.isLanding = false;
    }

    getMaxTier() {
        if (typeof TIER_STATS !== 'undefined') {
            if (Array.isArray(TIER_STATS)) return Math.min(3, TIER_STATS.length - 1);
            if (typeof TIER_STATS === 'object') {
                const keys = Object.keys(TIER_STATS).filter(k => !isNaN(k));
                if (keys.length > 0) return Math.min(3, Math.max(...keys.map(Number)));
            }
        }
        return 3;
    }

    getUpgradeCost() {
        if (typeof TIER_STATS !== 'undefined' && TIER_STATS[this.level]) {
            return TIER_STATS[this.level].upgradeCost || 10;
        }
        return 10;
    }

    getOrbitingShipsCount(ships) {
        if (!ships || !Array.isArray(ships)) return 0;
        return ships.filter(s => 
            s && 
            !s.dead && 
            s.targetPlanet === this && 
            s.state === 'orbit'
        ).length;
    }

    startUpgrade(ships) {
        if (!ships || !Array.isArray(ships)) return;

        const maxTier = this.getMaxTier();
        const upgCost = this.getUpgradeCost();

        if (this.level >= maxTier || upgCost <= 0) return;

        const landingCount = ships.filter(s => 
            s && 
            !s.dead && 
            s.owner === this.owner && 
            s.targetPlanet === this && 
            s.state === 'landing'
        ).length;

        const needed = upgCost - (this.upgradeProgress + landingCount);
        if (needed <= 0) return;

        const eligibleShips = ships.filter(s => 
            s &&
            !s.dead && 
            s.owner === this.owner && 
            s.targetPlanet === this && 
            s.state === 'orbit'
        );

        if (eligibleShips.length === 0) return;

        for (let i = eligibleShips.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [eligibleShips[i], eligibleShips[j]] = [eligibleShips[j], eligibleShips[i]];
        }

        const shipsToLand = eligibleShips.slice(0, needed);
        for (let ship of shipsToLand) {
            ship.targetPlanet = this;
            ship.state = 'landing';
            ship.landingProgress = 0;
        }
    }

    onShipTouchdown(ship, gameManager) {
        if (!ship) return;

        const power = ship.touchdownPower || 1.0;

        if (this.owner === 0) {
            this.upgradeProgress += power;
            const claimRequirement = this.claimCost || 5;
            if (this.upgradeProgress >= claimRequirement) {
                this.owner = ship.owner;
                this.level = 1;
                this.maxHp = 20;
                this.hp = this.maxHp;
                this.upgradeProgress = 0;
                this.isLanding = false;
            }
        } 
        else if (this.owner === ship.owner) {
            const maxTier = this.getMaxTier();
            const upgCost = this.getUpgradeCost();

            if (this.level < maxTier) {
                this.upgradeProgress += power;
                if (this.upgradeProgress >= upgCost) {
                    this.upgrade();
                }
            }
        } 
        else if (this.owner !== ship.owner) {
            this.hp -= power;
            if (this.hp <= 0) {
                this.owner = ship.owner;
                this.level = 1;
                const stats = (typeof TIER_STATS !== 'undefined' && TIER_STATS[1]) ? TIER_STATS[1] : { maxHP: 20 };
                this.maxHp = stats.maxHP || 20;
                this.hp = this.maxHp;
                this.upgradeProgress = 0;
                this.isLanding = false;
            }
        }
    }

    upgrade() {
        const maxTier = this.getMaxTier();
        if (this.level < maxTier) {
            this.level++;
            const stats = (typeof TIER_STATS !== 'undefined' && TIER_STATS[this.level])
                ? TIER_STATS[this.level]
                : { maxHP: this.maxHp + 10 };

            this.maxHp = stats.maxHP || (this.maxHp + 10);
            this.hp = this.maxHp;
            this.upgradeProgress = 0;
            this.isLanding = false;
        }
    }

    update(dtUncapped, gameManager) {
        const dt = Math.min(dtUncapped || 0.016, 0.1);

        if (this.owner !== 0) {
            this.spawnTimer += dt;
            const stats = (typeof TIER_STATS !== 'undefined' && TIER_STATS[this.level]) ? TIER_STATS[this.level] : null;
            const baseInterval = stats ? stats.spawnInterval : 3;

            const faction = FactionManager.getFaction(this.owner, gameManager);
            const interval = baseInterval * (faction.spawnIntervalMult || 1.0);

            if (this.spawnTimer >= interval) {
                this.spawnTimer = 0;
                if (gameManager && typeof gameManager.spawnShip === 'function') {
                    gameManager.spawnShip(this, this);
                }
            }

            if (this.hp < this.maxHp) {
                this.regenTimer += dt;
                if (this.regenTimer >= 3.0) {
                    this.regenTimer = 0;
                    this.hp = Math.min(this.maxHp, this.hp + 1);
                }
            } else {
                this.regenTimer = 0;
            }
        }
    }

    draw(ctx, ships, gameManager) {
        const activeColor = FactionManager.getColor(this.owner, gameManager);

        ctx.save();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = activeColor;
        ctx.fill();

        const maxTier = this.getMaxTier();
        const orbitCount = this.getOrbitingShipsCount(ships);

        const lines = [];
        lines.push(`Ships: ${orbitCount}`);
        lines.push(`Lvl: ${this.level}/${maxTier}`);

        if (this.owner !== 0) {
            lines.push(`HP: ${Math.ceil(this.hp)}/${this.maxHp}`);
            const upgCost = this.getUpgradeCost();
            if (this.level < maxTier && upgCost > 0) {
                lines.push(`Upg: ${Math.floor(this.upgradeProgress)}/${upgCost}`);
            }
        } else {
            const claimCost = this.claimCost || 5;
            lines.push(`Cap: ${Math.floor(this.upgradeProgress)}/${claimCost}`);
        }

        const fontSize = 9;
        const lineHeight = 11;
        const totalHeight = lines.length * lineHeight;
        let startY = this.y - (totalHeight / 2) + (fontSize / 2);

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], this.x, startY + (i * lineHeight));
        }

        ctx.restore();
    }
}