const FACTION_DATA = {
    HUMAN: {
        id: 'HUMAN',
        name: 'Human Remnants',
        tagline: 'Versatile & balanced baseline fleet.',
        color: '#00aaff',
        hp: 20,
        laserDamage: 10,
        laserCooldown: 0.45,
        laserRange: 45.0, // Halved from 90.0
        maxSpeed: 45.0,
        enginePower: 70.0,
        transitTurnRate: 5.0,
        combatTurnRate: 12.0,
        spawnIntervalMult: 1.0
    },
    GOLIATH: {
        id: 'GOLIATH',
        name: 'Iron Goliaths',
        tagline: 'Heavy armor & brutal volley, low acceleration and slow turn rates.',
        color: '#ff8800',
        hp: 35,
        laserDamage: 16,
        laserCooldown: 0.65,
        laserRange: 48.0, // Halved from 95.0
        maxSpeed: 45.0,
        enginePower: 48.0,
        transitTurnRate: 3.2,
        combatTurnRate: 8.0,
        spawnIntervalMult: 1.30
    },
    HIVE: {
        id: 'HIVE',
        name: 'Hive Chitin',
        tagline: 'Fragile swarm ships with rapid spawns and swift thrusters.',
        color: '#33ff55',
        hp: 10,
        laserDamage: 6,
        laserCooldown: 0.28,
        laserRange: 40.0, // Halved from 80.0
        maxSpeed: 45.0,
        enginePower: 95.0,
        transitTurnRate: 6.8,
        combatTurnRate: 16.0,
        spawnIntervalMult: 0.50
    },
    PROTOCOL: {
        id: 'PROTOCOL',
        name: 'Protocol Zero',
        tagline: 'Precision AI snipers with long range and quick response thrusters.',
        color: '#ff2255',
        hp: 15,
        laserDamage: 14,
        laserCooldown: 0.50,
        laserRange: 55.0, // Halved from 110.0
        maxSpeed: 45.0,
        enginePower: 82.0,
        transitTurnRate: 6.0,
        combatTurnRate: 14.0,
        spawnIntervalMult: 1.10
    },
    SCRAPPER: {
        id: 'SCRAPPER',
        name: 'Rust Scrappers',
        tagline: 'Aggressive short-range brawlers with fast pulse fire.',
        color: '#e6ad00',
        hp: 18,
        laserDamage: 9,
        laserCooldown: 0.32,
        laserRange: 38.0, // Halved from 75.0
        maxSpeed: 45.0,
        enginePower: 80.0,
        transitTurnRate: 5.0,
        combatTurnRate: 13.0,
        spawnIntervalMult: 0.90
    },
    ARCHON: {
        id: 'ARCHON',
        name: 'Archon Covenant',
        tagline: 'Defensive turtles with extreme in-combat orbit rotation.',
        color: '#aa44ff',
        hp: 26,
        laserDamage: 11,
        laserCooldown: 0.42,
        laserRange: 45.0, // Halved from 90.0
        maxSpeed: 45.0,
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
    laserRange: 45.0,
    maxSpeed: 45.0,
    enginePower: 70.0,
    transitTurnRate: 5.0,
    combatTurnRate: 12.0,
    spawnIntervalMult: 1.0
};

class FactionManager {
    static getFaction(ownerId, gameManager) {
        if (!ownerId || ownerId === 0) return NEUTRAL_FACTION;

        let factionKey = null;

        // Check GameManager mapping
        if (gameManager && gameManager.factionMap) {
            factionKey = gameManager.factionMap[ownerId];
        }

        // Default fallbacks
        if (!factionKey) {
            if (ownerId === 1) factionKey = 'HUMAN';
            else if (ownerId === 2) factionKey = 'PROTOCOL';
        }

        // Normalize string lookup (handles 'protocol' vs 'PROTOCOL')
        if (typeof factionKey === 'string') {
            factionKey = factionKey.toUpperCase();
        }

        return FACTION_DATA[factionKey] || FACTION_DATA.HUMAN;
    }

    static getColor(ownerId, gameManager) {
        return this.getFaction(ownerId, gameManager).color;
    }
}