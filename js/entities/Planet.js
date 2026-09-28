class Planet {
    constructor(x, y, level, owner) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.owner = owner;

        const stats = TIER_STATS[level];
        this.radius = stats.radius;
        this.maxHp = stats.maxHP;
        this.hp = owner !== 0 ? stats.maxHP : 5;
        this.spawnTimer = 0;
        this.regenTimer = 0;

        this.upgradeProgress = 0;
        this.isLanding = false;
    }

    getOrbitingShipsCount(ships) {
        return ships.filter(s => s.targetPlanet === this && (s.state === 'orbit' || s.state === 'landing') && !s.dead).length;
    }

    startLanding(ships) {
        if (this.level >= 3 || this.owner === 0) return;
        this.isLanding = true;

        ships.forEach(s => {
            if (s.targetPlanet === this && s.state === 'orbit' && !s.dead) {
                s.state = 'landing';
            }
        });
    }

    cancelLanding(ships) {
        this.isLanding = false;
        ships.forEach(s => {
            if (s.targetPlanet === this && s.state === 'landing' && !s.dead) {
                s.state = 'orbit';
            }
        });
    }

    upgrade(ships) {
        if (this.level < 3) {
            this.level++;
            const stats = TIER_STATS[this.level];
            this.radius = stats.radius;
            this.maxHp = stats.maxHP;
            this.hp = stats.maxHP;
            this.upgradeProgress = 0;
            this.cancelLanding(ships);
        }
    }

    update(dt, gameManager) {
        if (this.owner !== 0) {
            this.spawnTimer += dt;
            const stats = TIER_STATS[this.level];
            if (this.spawnTimer >= stats.spawnInterval) {
                this.spawnTimer = 0;
                gameManager.spawnShip(this, this);
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

        if (this.isLanding) {
            const landingCount = gameManager.ships.filter(s => s.targetPlanet === this && s.state === 'landing' && !s.dead).length;
            if (landingCount === 0) {
                this.isLanding = false;
            }
        }
    }

    draw(ctx, ships) {
        const activeColor = OWNER_COLORS[this.owner];

        // Core Planet Body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = activeColor;
        ctx.fill();

        // Upgrade Progress Ring (Gold)
        if (this.owner !== 0 && this.level < 3 && this.upgradeProgress > 0) {
            const reqCost = TIER_STATS[this.level].upgradeCost;
            const progressPercent = this.upgradeProgress / reqCost;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 7, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progressPercent));
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3.0;
            ctx.stroke();
        }

        // HP Ring
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        if (hpPercent > 0 && hpPercent < 1) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3.5, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * hpPercent));
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // Defender Count Text with High-Contrast Stroke
        const countText = this.getOrbitingShipsCount(ships).toString();
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(countText, this.x, this.y);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(countText, this.x, this.y);
    }
}