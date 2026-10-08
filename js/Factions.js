const BASELINE_FACTION = {
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

const FACTION_DATA = {
    HUMAN: { id: 'HUMAN', name: 'Human Remnants', tagline: 'Versatile baseline.', color: '#00aaff', ...BASELINE_FACTION },
    GOLIATH: { id: 'GOLIATH', name: 'Iron Goliaths', tagline: 'Heavy armor.', color: '#ff8800', ...BASELINE_FACTION },
    HIVE: { id: 'HIVE', name: 'Hive Chitin', tagline: 'Swarm forces.', color: '#33ff55', ...BASELINE_FACTION },
    PROTOCOL: { id: 'PROTOCOL', name: 'Protocol Zero', tagline: 'Precision snipers.', color: '#ff2255', ...BASELINE_FACTION },
    SCRAPPER: { id: 'SCRAPPER', name: 'Rust Scrappers', tagline: 'Aggressive brawlers.', color: '#e6ad00', ...BASELINE_FACTION },
    ARCHON: { id: 'ARCHON', name: 'Archon Covenant', tagline: 'Fortress defense.', color: '#aa44ff', ...BASELINE_FACTION }
};

const NEUTRAL_FACTION = {
    id: 'NEUTRAL',
    name: 'Unclaimed',
    tagline: 'Unclaimed territory.',
    color: '#ffffff',
    ...BASELINE_FACTION
};

class FactionManager {
    static getFaction(ownerId, gameManager) {
        if (!ownerId || ownerId === 0) return NEUTRAL_FACTION;

        let factionKey = null;
        if (gameManager && gameManager.factionMap) {
            factionKey = gameManager.factionMap[ownerId];
        }

        if (!factionKey) {
            factionKey = ownerId === 1 ? 'HUMAN' : 'PROTOCOL';
        }

        if (typeof factionKey === 'string') {
            factionKey = factionKey.toUpperCase();
        }

        return FACTION_DATA[factionKey] || FACTION_DATA.HUMAN;
    }

    static getColor(ownerId, gameManager) {
        return this.getFaction(ownerId, gameManager).color;
    }
}