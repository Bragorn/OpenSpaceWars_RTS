const FACTION_DATA = {
    HUMAN: {
        id: 'HUMAN',
        name: 'Human Remnants',
        tagline: 'Versatile & balanced baseline fleet.',
        color: '#00aaff',
        hp: 20,
        laserDamage: 10,
        laserCooldown: 0.45,
        laserRange: 90.0,
        maxSpeed: 42.0,
        enginePower: 70.0,
        transitTurnRate: 5.0,
        combatTurnRate: 12.0,
        spawnIntervalMult: 1.0
    },
    GOLIATH: {
        id: 'GOLIATH',
        name: 'Iron Goliaths',
        tagline: 'Heavy armor & brutal damage, but slow transit and spawns.',
        color: '#ff8800',
        hp: 35,
        laserDamage: 16,
        laserCooldown: 0.65,
        laserRange: 95.0,
        maxSpeed: 28.0,
        enginePower: 48.0,
        transitTurnRate: 3.5,
        combatTurnRate: 8.0,
        spawnIntervalMult: 1.4
    },
    HIVE: {
        id: 'HIVE',
        name: 'Hive Chitin',
        tagline: 'Fragile swarm ships with rapid spawns and swift velocity.',
        color: '#33ff55',
        hp: 10,
        laserDamage: 6,
        laserCooldown: 0.28,
        laserRange: 80.0,
        maxSpeed: 58.0,
        enginePower: 95.0,
        transitTurnRate: 7.0,
        combatTurnRate: 16.0,
        spawnIntervalMult: 0.6
    },
    PROTOCOL: {
        id: 'PROTOCOL',
        name: 'Protocol Zero',
        tagline: 'Precision AI snipers with high speed and high damage.',
        color: '#ff2255',
        hp: 15,
        laserDamage: 14,
        laserCooldown: 0.50,
        laserRange: 110.0,
        maxSpeed: 48.0,
        enginePower: 80.0,
        transitTurnRate: 6.0,
        combatTurnRate: 14.0,
        spawnIntervalMult: 1.1
    },
    SCRAPPER: {
        id: 'SCRAPPER',
        name: 'Rust Scrappers',
        tagline: 'Aggressive brawlers with fast pulse lasers.',
        color: '#e6ad00',
        hp: 18,
        laserDamage: 11,
        laserCooldown: 0.38,
        laserRange: 85.0,
        maxSpeed: 42.0,
        enginePower: 75.0,
        transitTurnRate: 5.0,
        combatTurnRate: 12.0,
        spawnIntervalMult: 0.95
    },
    ARCHON: {
        id: 'ARCHON',
        name: 'Archon Covenant',
        tagline: 'Defensive turtles with high orbit maneuverability.',
        color: '#aa44ff',
        hp: 25,
        laserDamage: 10,
        laserCooldown: 0.42,
        laserRange: 90.0,
        maxSpeed: 32.0,
        enginePower: 55.0,
        transitTurnRate: 4.0,
        combatTurnRate: 18.0,
        spawnIntervalMult: 1.25
    }
};

const NEUTRAL_FACTION = {
    id: 'NEUTRAL',
    name: 'Unclaimed',
    tagline: 'Unclaimed territory.',
    color: '#ffffff',
    hp: 20,
    laserDamage: 10,
    laserCooldown: 0.45,
    laserRange: 90.0,
    maxSpeed: 42.0,
    enginePower: 70.0,
    transitTurnRate: 5.0,
    combatTurnRate: 12.0,
    spawnIntervalMult: 1.0
};

class FactionManager {
    static getFaction(ownerId, gameManager) {
        if (!ownerId || ownerId === 0) return NEUTRAL_FACTION;

        let factionKey = null;
        if (gameManager && gameManager.factionMap) {
            factionKey = gameManager.factionMap[ownerId];
        }

        if (!factionKey) {
            if (ownerId === 1) factionKey = 'HUMAN';
            else if (ownerId === 2) factionKey = 'PROTOCOL';
        }

        return FACTION_DATA[factionKey] || FACTION_DATA.HUMAN;
    }

    static getColor(ownerId, gameManager) {
        return this.getFaction(ownerId, gameManager).color;
    }
}