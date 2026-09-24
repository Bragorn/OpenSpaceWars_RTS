class Star {
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
        this.isAbsorbing = false;

        const cx = arenaSize / 2;
        const cy = arenaSize / 2;
        const dx = x - cx;
        const dy = y - cy;
        this.orbitAngle = Math.atan2(dy, dx);
        this.orbitDistance = Math.sqrt(dx * dx + dy * dy);
    }

    get orbitingUnitsCount() {
        return units.filter(u => u.targetStar === this && (u.state === 'orbit' || u.state === 'sucking') && !u.dead).length;
    }

    startUpgradeSuction() {
        if (this.level >= 3 || this.owner === 0) return;
        this.isAbsorbing = true;
        
        units.forEach(u => {
            if (u.targetStar === this && u.state === 'orbit' && !u.dead) {
                u.state = 'sucking';
            }
        });
    }

    cancelSuctionAndRelease() {
        this.isAbsorbing = false;
        units.forEach(u => {
            if (u.targetStar === this && u.state === 'sucking' && !u.dead) {
                u.state = 'orbit';
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
            this.cancelSuctionAndRelease();
        }
    }

    update(dt) {
        if (this.orbitDistance > 0) {
            this.orbitAngle += 0.012 * dt;
            const cx = arenaSize / 2;
            const cy = arenaSize / 2;
            this.x = cx + Math.cos(this.orbitAngle) * this.orbitDistance;
            this.y = cy + Math.sin(this.orbitAngle) * this.orbitDistance;
        }

        if (this.owner !== 0) {
            // Unit Spawning
            this.spawnTimer += dt;
            const stats = TIER_STATS[this.level];
            if (this.spawnTimer >= stats.spawnInterval) {
                this.spawnTimer = 0;
                spawnUnit(this, this);
            }

            // Passive HP Regeneration
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

        if (this.isAbsorbing) {
            const suckingCount = units.filter(u => u.targetStar === this && u.state === 'sucking' && !u.dead).length;
            if (suckingCount === 0) {
                this.isAbsorbing = false;
            }
        }
    }

    draw() {
        const activeColor = this.owner !== 0 ? OWNER_COLORS[this.owner] : OWNER_COLORS[0];

        // Star core
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = OWNER_COLORS[this.owner];
        ctx.fill();

        // Upgrade Progress Ring
        if (this.owner !== 0 && this.level < 3) {
            const reqCost = TIER_STATS[this.level].upgradeCost;
            if (this.upgradeProgress > 0) {
                const progressPercent = this.upgradeProgress / reqCost;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progressPercent));
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
        }

        // HP Ring
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        if (hpPercent > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * hpPercent));
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 2.0;
            ctx.stroke();
        }

        // Count Text
        ctx.fillStyle = '#08090d';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.orbitingUnitsCount, this.x, this.y);
    }
}