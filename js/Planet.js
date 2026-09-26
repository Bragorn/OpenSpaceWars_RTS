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

        const cx = arenaSize / 2;
        const cy = arenaSize / 2;
        const dx = x - cx;
        const dy = y - cy;
        this.orbitAngle = Math.atan2(dy, dx);
        this.orbitDistance = Math.sqrt(dx * dx + dy * dy);
    }

    get orbitingShipsCount() {
        return ships.filter(s => s.targetPlanet === this && (s.state === 'orbit' || s.state === 'landing') && !s.dead).length;
    }

    startLanding() {
        if (this.level >= 3 || this.owner === 0) return;
        this.isLanding = true;

        ships.forEach(s => {
            if (s.targetPlanet === this && s.state === 'orbit' && !s.dead) {
                s.state = 'landing';
            }
        });
    }

    cancelLanding() {
        this.isLanding = false;
        ships.forEach(s => {
            if (s.targetPlanet === this && s.state === 'landing' && !s.dead) {
                s.state = 'orbit';
            }
        });
    }

    upgrade() {
        if (this.level < 3) {
            this.level++;
            const stats = TIER_STATS[this.level];
            this.radius = stats.radius;
            this.maxHp = stats.maxHP;
            this.hp = stats.maxHP;
            this.upgradeProgress = 0;
            this.cancelLanding();
        }
    }

    update(dt) {
        if (this.orbitDistance > 0) {
            const orbitSpeed = 0.25 / Math.sqrt(this.orbitDistance);
            this.orbitAngle += orbitSpeed * dt;

            const cx = arenaSize / 2;
            const cy = arenaSize / 2;
            this.x = cx + Math.cos(this.orbitAngle) * this.orbitDistance;
            this.y = cy + Math.sin(this.orbitAngle) * this.orbitDistance;
        }

        if (this.owner !== 0) {
            this.spawnTimer += dt;
            const stats = TIER_STATS[this.level];
            if (this.spawnTimer >= stats.spawnInterval) {
                this.spawnTimer = 0;
                spawnShip(this, this);
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
            const landingCount = ships.filter(s => s.targetPlanet === this && s.state === 'landing' && !s.dead).length;
            if (landingCount === 0) {
                this.isLanding = false;
            }
        }
    }

    draw() {
        const activeColor = OWNER_COLORS[this.owner];

        // Core Planet
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = activeColor;
        ctx.fill();

        // Upgrade Progress Ring (Gold)
        if (this.owner !== 0 && this.level < 3 && this.upgradeProgress > 0) {
            const reqCost = TIER_STATS[this.level].upgradeCost;
            const progressPercent = this.upgradeProgress / reqCost;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 6, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progressPercent));
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // HP Outline Ring
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        if (hpPercent > 0 && hpPercent < 1) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * hpPercent));
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 2.0;
            ctx.stroke();
        }

        // Defender Count Text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.orbitingShipsCount, this.x, this.y);
    }
}