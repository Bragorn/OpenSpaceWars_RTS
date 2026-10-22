// Shared by every faction. Each faction below overrides hp, spawnIntervalMult, planetHpMult, upgradeCostMult.
const BASELINE_FACTION = {
    hp: 30,                  // overridden per faction (hits to kill = hp / laserDamage)
    laserDamage: 10,
    laserCooldown: 0.5,
    laserRange: 25.0,
    maxSpeed: 50.0,
    enginePower: 10.0,
    transitTurnRate: 10.0,
    combatTurnRate: 10.0,
    spawnIntervalMult: 1.0,  // overridden per faction
    planetHpMult: 1.0,       // overridden per faction (tentative)
    upgradeCostMult: 1.0,    // overridden per faction: ships needed per upgrade (rounded to whole ships)

    // AI behavior (same for every faction)
    aiUpdateInterval: 2.0,   // seconds spent "thinking" between rounds of decisions
    aiActionDelay: 0.4       // average seconds between executing queued moves
};

const FACTION_DATA = {
    REMNANTS:     { id: 'REMNANTS',     name: 'Remnant Corps',    tagline: 'Versatile baseline.',  color: '#36C7FF', palette: { light: '#99E2FF', base: '#36C7FF', dark: '#0080B3', shadow: '#00374D' }, ...BASELINE_FACTION, hp: 30, spawnIntervalMult: 1.4,  planetHpMult: 3.0, upgradeCostMult: 1.0 },
    MOUNTAINBORN: { id: 'MOUNTAINBORN', name: 'Mountainborn',     tagline: 'Heavy armor.',         color: '#55E04A', palette: { light: '#A5EF9F', base: '#55E04A', dark: '#208B18', shadow: '#0E3D0A' }, ...BASELINE_FACTION, hp: 60, spawnIntervalMult: 2.0,  planetHpMult: 6.0, upgradeCostMult: 0.85 },
    VESPID:       { id: 'VESPID',       name: 'Vespid Swarm',     tagline: 'Swarm forces.',        color: '#FFD21F', palette: { light: '#FFE88F', base: '#FFD21F', dark: '#A38200', shadow: '#473900' }, ...BASELINE_FACTION, hp: 10, spawnIntervalMult: 1.0,  planetHpMult: 1.0, upgradeCostMult: 1.2 },
    PROTOCOL:     { id: 'PROTOCOL',     name: 'Protocol Zero',    tagline: 'Precision snipers.',   color: '#FF2A2A', palette: { light: '#FF8585', base: '#FF2A2A', dark: '#AD0000', shadow: '#4D0000' }, ...BASELINE_FACTION, hp: 40, spawnIntervalMult: 1.6,  planetHpMult: 4.0, upgradeCostMult: 0.95 },
    STATIC:       { id: 'STATIC',       name: 'Static Syndicate', tagline: 'Aggressive brawlers.', color: '#FF2BB8', palette: { light: '#FF8AD8', base: '#FF2BB8', dark: '#AD0074', shadow: '#4D0033' }, ...BASELINE_FACTION, hp: 50, spawnIntervalMult: 1.8,  planetHpMult: 5.0, upgradeCostMult: 0.9 },
    CROWN:        { id: 'CROWN',        name: 'Violet Crown',     tagline: 'Fortress defense.',    color: '#7A2CFF', palette: { light: '#BF99FF', base: '#7A2CFF', dark: '#4400B8', shadow: '#1E0052' }, ...BASELINE_FACTION, hp: 20, spawnIntervalMult: 1.2,  planetHpMult: 2.0, upgradeCostMult: 1.1 }
};

const FACTION_TEST_MODE = false;   // true = every faction gets identical stats (mirror test)
if (FACTION_TEST_MODE) {
    for (const f of Object.values(FACTION_DATA)) {
        Object.assign(f, { hp: 30, spawnIntervalMult: 1.0, planetHpMult: 1.0, upgradeCostMult: 1.0 });
    }
}

const NEUTRAL_FACTION = {
    id: 'NEUTRAL',
    name: 'Unclaimed',
    tagline: 'Unclaimed territory.',
    color: '#FFFFFF',
    palette: { light: '#FFFFFF', base: '#FFFFFF', dark: '#8A8F98', shadow: '#2A2D33' },
    ...BASELINE_FACTION
};

class FactionManager {
    static getFaction(ownerId, gameManager) {
        if (!ownerId || ownerId === 0) return NEUTRAL_FACTION;

        return FACTION_DATA[gameManager.factionMap[ownerId]];
    }

    static getColor(ownerId, gameManager) {
        return this.getFaction(ownerId, gameManager).color;
    }

    static getPalette(ownerId, gameManager) {
        return this.getFaction(ownerId, gameManager).palette;
    }
}