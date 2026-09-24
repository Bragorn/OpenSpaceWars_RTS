class Unit {
    constructor(sourceStar, targetStar) {
        this.owner = sourceStar.owner;
        this.targetStar = targetStar;
        this.x = sourceStar.x + (Math.random() - 0.5) * sourceStar.radius;
        this.y = sourceStar.y + (Math.random() - 0.5) * sourceStar.radius;
        
        this.speed = 25;
        this.state = sourceStar === targetStar ? 'orbit' : 'moving';
        
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.targetOrbitRadius = sourceStar.radius + 8 + Math.random() * 12;
        this.currentOrbitRadius = this.targetOrbitRadius;
        
        this.dead = false;
    }

    update(dt) {
        if (this.dead) return;

        // --- STATE 1: SUCKING (Spiral Inward Upgrade) ---
        if (this.state === 'sucking') {
            this.orbitAngle += 3.5 * dt;
            this.currentOrbitRadius -= 35 * dt;

            this.x = this.targetStar.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
            this.y = this.targetStar.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;

            if (this.currentOrbitRadius <= 3) {
                destroyUnit(this);
                this.targetStar.upgradeProgress++;
                
                const reqCost = TIER_STATS[this.targetStar.level].upgradeCost;
                if (this.targetStar.upgradeProgress >= reqCost) {
                    this.targetStar.upgrade();
                }
            }
            return;
        }

        // --- STATE 2: ORBIT & DEFENSE INTERCEPTION ---
        if (this.state === 'orbit') {
            if (this.currentOrbitRadius < this.targetOrbitRadius) {
                this.currentOrbitRadius = Math.min(this.targetOrbitRadius, this.currentOrbitRadius + 20 * dt);
            }

            let targetEnemy = null;
            let minEnemyDistSq = 3600; // Defense radius (~60px)

            for (let i = 0; i < units.length; i++) {
                const other = units[i];
                if (other !== this && !other.dead && other.owner !== this.owner) {
                    const dxStar = other.x - this.targetStar.x;
                    const dyStar = other.y - this.targetStar.y;
                    const distToStarSq = dxStar * dxStar + dyStar * dyStar;

                    if (distToStarSq < minEnemyDistSq) {
                        const dx = other.x - this.x;
                        const dy = other.y - this.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < minEnemyDistSq) {
                            minEnemyDistSq = distSq;
                            targetEnemy = other;
                        }
                    }
                }
            }

            if (targetEnemy) {
                const dx = targetEnemy.x - this.x;
                const dy = targetEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 25) {
                    destroyUnit(this);
                    destroyUnit(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.x += (dx / dist) * (this.speed * 1.3) * dt;
                    this.y += (dy / dist) * (this.speed * 1.3) * dt;
                }
            } else {
                this.orbitAngle += 1.2 * dt;
                this.x = this.targetStar.x + Math.cos(this.orbitAngle) * this.currentOrbitRadius;
                this.y = this.targetStar.y + Math.sin(this.orbitAngle) * this.currentOrbitRadius;
            }
            return;
        }

        // --- STATE 3: MOVING (Attacking / Transit) ---
        if (this.state === 'moving') {
            let targetEnemy = null;
            let minEnemyDistSq = 900;

            for (let i = 0; i < units.length; i++) {
                const other = units[i];
                if (other !== this && !other.dead && other.owner !== this.owner) {
                    const dx = other.x - this.x;
                    const dy = other.y - this.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minEnemyDistSq) {
                        minEnemyDistSq = distSq;
                        targetEnemy = other;
                    }
                }
            }

            if (targetEnemy) {
                const dx = targetEnemy.x - this.x;
                const dy = targetEnemy.y - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 25) {
                    destroyUnit(this);
                    destroyUnit(targetEnemy);
                    return;
                } else {
                    const dist = Math.sqrt(distSq);
                    this.x += (dx / dist) * this.speed * dt;
                    this.y += (dy / dist) * this.speed * dt;
                }
            } else {
                const dx = this.targetStar.x - this.x;
                const dy = this.targetStar.y - this.y;
                const distSq = dx * dx + dy * dy;
                const impactDist = this.targetStar.radius + 4;

                if (distSq < impactDist * impactDist) {
                    handleStarImpact(this);
                } else {
                    const dist = Math.sqrt(distSq);
                    this.x += (dx / dist) * this.speed * dt;
                    this.y += (dy / dist) * this.speed * dt;
                }
            }
        }
    }

    // Add path to current canvas context without drawing yet
    path() {
        if (this.dead) return;
        ctx.moveTo(this.x + 2, this.y);
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    }
}