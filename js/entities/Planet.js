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
        return ships.filter(s => 
            s.orbitPlanet === this && 
            (s.state === 'orbit' || s.state === 'landing' || s.state === 'launching' || s.state === 'surface_launch' || s.state === 'circularizing' || s.state === 'insertion') && 
            !s.dead
        ).length;
    }

    startLanding(ships) {
        if (this.level >= 3 || this.owner === 0) return;
        this.isLanding = true;

        ships.forEach(s => {
            if (s.orbitPlanet === this && s.state === 'orbit' && !s.dead) {
                s.state = 'landing';
            }
        });
    }

    cancelLanding(ships) {
        this.isLanding = false;
        ships.forEach(s => {
            if (s.orbitPlanet === this && s.state === 'landing' && !s.dead) {
                s.state = 'orbit';
            }
        });
    }

    upgrade(ships) {
        if (this.level < 3) {
            this.level++;
            const stats = TIER_STATS[this.level];
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
            const landingCount = gameManager.ships.filter(s => s.orbitPlanet === this && s.state === 'landing' && !s.dead).length;
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

        // Defender Count Text
        const countText = this.getOrbitingShipsCount(ships).toString();
        const textY = this.owner !== 0 ? this.y - 7 : this.y;

        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(countText, this.x, textY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(countText, this.x, textY);

        if (this.owner === 0) return;

        const barWidth = Math.max(22, this.radius * 0.75);
        const barHeight = 3.5;
        const barX = this.x - barWidth / 2;

        // Health Bar
        if (this.hp < this.maxHp) {
            const hpY = this.y + 5;
            const hpPercent = Math.max(0, this.hp / this.maxHp);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, hpY, barWidth, barHeight);

            ctx.fillStyle = hpPercent < 0.3 ? '#ff3333' : '#33cc66';
            ctx.fillRect(barX, hpY, barWidth * hpPercent, barHeight);

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, hpY, barWidth, barHeight);
        }

        // Upgrade Progress Bar
        if (this.level < 3 && this.upgradeProgress > 0) {
            const upgY = this.hp < this.maxHp ? this.y + 11 : this.y + 5;
            const reqCost = TIER_STATS[this.level].upgradeCost;
            const progressPercent = Math.min(1, this.upgradeProgress / reqCost);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, upgY, barWidth, barHeight);

            ctx.fillStyle = '#ffd700';
            ctx.fillRect(barX, upgY, barWidth * progressPercent, barHeight);

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, upgY, barWidth, barHeight);
        }
    }
}