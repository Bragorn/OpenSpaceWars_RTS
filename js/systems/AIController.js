// AI v2: each planet decides alone, using ship counts for landing math and
// strength (ships x HP) for fight odds. All reads go through getVisibleState()
// so fog of war / difficulty levels can be added there later.
// Switches for A/B testing AI changes (sim.html has a checkbox for these)
const AI_OPTS = {
    countIncoming: false,
    idleScore: 0.1   // how attractive "do nothing" is next to attacking or saving up
};

class AIController {
    constructor(gameManager, teamOwner = 2) {
        this.gameManager = gameManager;
        this.teamOwner = teamOwner;
        this.aiTimer = 0;
        this.currentState = 'HOLDING';
        this.actionQueue = [];
        this.actionTimer = 0;
        // Behavior counters (read by sim.html; harmless in the game)
        this.stats = { attacks: 0, attackShips: 0, claims: 0, claimShips: 0, upgrades: 0 };
    }

    // ================= INFO HELPERS =================

    // Everything the AI is allowed to see (currently: everything)
    getVisibleState() {
        return {
            planets: this.gameManager.planets,
            ships: this.gameManager.ships.filter(s => !s.dead)
        };
    }

    hpOf(ownerId) {
        return FactionManager.getFaction(ownerId, this.gameManager).hp;
    }

    // Strength = ship count x total HP
    fleetStrength(count, ownerId) {
        return count * this.hpOf(ownerId);
    }

    // Fight strength under the square law: more ships count much more than tougher ships
    combatPower(count, ownerId) { return count * count * this.hpOf(ownerId); }

    getGlobalSpawnRate(ownerId) {
        const faction = FactionManager.getFaction(ownerId, this.gameManager);
        let total = 0;
        for (const p of this.gameManager.planets) {
            if (p.owner !== ownerId) continue;
            total += 1.0 / (p.statsFor(p.level).spawnInterval * faction.spawnIntervalMult);
        }
        return Math.max(0.01, total);
    }

    // Defenders at a planet: orbiting, waiting to launch, and lifting off all count
    // (an attacker can't tell them apart)
    countDefenders(vis, planet, ownerId) {
        let n = 0;
        for (const s of vis.ships) {
            if (s.owner !== ownerId) continue;
            if (s.state === 'orbit' && s.targetPlanet === planet) n++;
            else if ((s.state === 'surface_launch' || s.state === 'launching') && s.orbitPlanet === planet) n++;
        }
        return n;
    }

    // Enemy ships heading to or orbiting a planet
    countEnemiesHeadingTo(vis, planet) {
        let n = 0;
        for (const s of vis.ships) {
            if (s.owner !== this.teamOwner && s.targetPlanet === planet) n++;
        }
        return n;
    }

    // My ships already on the way to (or at) a target
    countMyIncoming(vis, planet) {
        let n = 0;
        for (const s of vis.ships) {
            if (s.owner === this.teamOwner && s.targetPlanet === planet) n++;
        }
        return n;
    }

    // Ships still needed to claim a neutral planet (before counting ships on the way)
    claimNeed(n) {
        const progress = Math.floor(n.upgradeProgress);
        if (n.claimOwner === 0) return n.claimCost;
        if (n.claimOwner === this.teamOwner) return n.claimCost - progress;
        return n.claimCost + progress;
    }

    getNearest(source, list) {
        let best = null, bestD = Infinity;
        for (const t of list) {
            const dx = t.x - source.x, dy = t.y - source.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = t; }
        }
        return best;
    }

    // Send exactly k of the ships sitting at the source (dispatchFleet takes a ratio)
    makeDispatch(source, target, k, orbiting, state, kind = 'CLAIM') {
        return { type: 'DISPATCH', kind, k, source, target, ratio: Math.min(1, k / orbiting + 1e-6), state };
    }

    // ================= QUEUE =================

    // Executes one queued move every aiActionDelay seconds (with jitter)
    runQueue(dt, profile) {
        if (this.actionQueue.length === 0) {
            this.actionTimer = 0;
            return;
        }
        this.actionTimer -= dt;
        if (this.actionTimer > 0) return;

        const a = this.actionQueue.shift();
        this.actionTimer = profile.aiActionDelay * (0.7 + Math.random() * 0.6);

        if (a.source.owner !== this.teamOwner) return; // lost the planet while waiting
        if (a.type === 'UPGRADE') {
            a.source.startUpgrade(this.gameManager.ships, a.maxCount);
            this.stats.upgrades++;
        } else {
            this.gameManager.dispatchFleet(a.source, a.target, a.ratio);
            if (a.kind === 'ATTACK') { this.stats.attacks++; this.stats.attackShips += a.k; }
            else { this.stats.claims++; this.stats.claimShips += a.k; }
        }
        this.currentState = a.state;
    }

    // ================= DECISIONS =================

    // Scores an attack from 0 to 1. The decision itself is made in decideForPlanet.
    tryAttack(source, target, surplus, orbiting, vis, planned) {
        const me = this.teamOwner;
        const inbound = this.countMyIncoming(vis, target) + (planned.get(target) || 0);

        const defenders = target.owner !== 0
            ? this.countDefenders(vis, target, target.owner)
            : this.countEnemiesHeadingTo(vis, target);

        // Undefended: just cover its HP
        if (defenders === 0) {
            const need = Math.ceil(target.hp) - inbound;
            if (need <= 0) return null;
            return { score: 1, k: Math.min(surplus, need), target };
        }

        const enemyOwner = target.owner !== 0 ? target.owner : (me === 1 ? 2 : 1);
        const mine = this.combatPower(surplus + (AI_OPTS.countIncoming ? inbound : 0), me);
        const theirs = this.combatPower(defenders, enemyOwner);
        const r = Math.sqrt(mine / theirs);
        const r3 = r * r * r;
        const score = r3 / (1 + r3);              // no floor: a hopeless attack scores about 0

        const k = Math.max(1, Math.floor(surplus * (r < 1 ? 0.5 : 1.0)));
        return { score, k, target };
    }

    decideForPlanet(source, ctx) {
        const { vis, neutrals, enemyPlanets, planned, upgradeWeight } = ctx;
        const me = this.teamOwner;
        const gm = this.gameManager;

        const orbiting = source.getOrbitingShipsCount(gm);
        if (orbiting === 0) return null;

        // Keep a reserve against enemies heading to / orbiting this planet
        const threat = this.countEnemiesHeadingTo(vis, source);
        const enemyOwner = me === 1 ? 2 : 1;
        const reserve = Math.ceil(this.fleetStrength(threat, enemyOwner) / this.hpOf(me));
        const surplus = orbiting - reserve;
        if (surplus <= 0) return null;

        // 1. Nearest neutral that is contested or still needs ships
        let fightTarget = null;
        const wanted = neutrals.filter(n =>
            this.countEnemiesHeadingTo(vis, n) > 0 ||
            this.claimNeed(n) - this.countMyIncoming(vis, n) - (planned.get(n) || 0) > 0);
        const neutral = this.getNearest(source, wanted);

        if (neutral) {
            if (this.countEnemiesHeadingTo(vis, neutral) > 0) {
                fightTarget = neutral; // contested: treat as a fight
            } else {
                const need = this.claimNeed(neutral) - this.countMyIncoming(vis, neutral) - (planned.get(neutral) || 0);
                const k = Math.min(surplus, need);
                planned.set(neutral, (planned.get(neutral) || 0) + k);
                return this.makeDispatch(source, neutral, k, orbiting, 'EXPANDING_NEUTRAL');
            }
        }

        // 2. Options: attack, save up for the upgrade, or do nothing. Each gets a score,
        //    then one is picked by weighted chance.
        if (!fightTarget) fightTarget = this.getNearest(source, enemyPlanets);
        const attack = fightTarget ? this.tryAttack(source, fightTarget, surplus, orbiting, vis, planned) : null;

        const cost = source.getUpgradeCost();
        const canUpgrade = threat === 0 && source.level < source.getMaxTier() && cost > 0;
        const attackScore = attack ? attack.score : 0;
        const upgradeScore = canUpgrade ? Math.min(1, orbiting / cost) : 0;   // how close to the price

        let roll = Math.random() * (attackScore + upgradeScore + AI_OPTS.idleScore);

        if ((roll -= attackScore) < 0) {
            planned.set(attack.target, (planned.get(attack.target) || 0) + attack.k);
            return this.makeDispatch(source, attack.target, attack.k, orbiting, 'ASSAULTING_ENEMY', 'ATTACK');
        }
        if ((roll -= upgradeScore) < 0) {
            if (orbiting >= cost) {
                return { type: 'UPGRADE', source, maxCount: cost, state: `UPGRADING_PLANET_${source.level + 1}` };
            }
            return null;   // not enough ships yet: keep saving
        }
        return null;       // do nothing this round
    }

    update(dt) {
        const profile = FactionManager.getFaction(this.teamOwner, this.gameManager);

        // Finish queued moves first; only think again once the queue is empty
        this.runQueue(dt, profile);
        if (this.actionQueue.length > 0) return;

        this.aiTimer += dt;
        if (this.aiTimer < profile.aiUpdateInterval) return;
        this.aiTimer = 0;

        const me = this.teamOwner;
        const enemyOwner = me === 1 ? 2 : 1;
        const vis = this.getVisibleState();

        const owned = vis.planets.filter(p => p.owner === me);
        const others = vis.planets.filter(p => p.owner !== me);
        if (others.length === 0) {
            this.currentState = 'SYSTEM_SECURED';
            return;
        }

        const ctx = {
            vis,
            neutrals: others.filter(p => p.owner === 0),
            enemyPlanets: others.filter(p => p.owner !== 0),
            planned: new Map(),
        };

        let acted = false;
        for (const source of owned) {
            const action = this.decideForPlanet(source, ctx);
            if (action) {
                this.actionQueue.push(action);
                acted = true;
            }
        }

        if (!acted) this.currentState = 'HOLDING';
    }
}