const BASELINE_FACTION = {
    hp: 20,
    laserDamage: 10,
    laserCooldown: 0.4,
    laserRange: 25.0,
    maxSpeed: 50.0,
    enginePower: 10.0,
    transitTurnRate: 10.0,
    combatTurnRate: 10.0,
    spawnIntervalMult: 1.0
};

const FACTION_DATA = {
    REMNANTS:     { id: 'REMNANTS',     name: 'Remnant Corps',    tagline: 'Versatile baseline.',  color: '#36C7FF', palette: { light: '#99E2FF', base: '#36C7FF', dark: '#0080B3', shadow: '#00374D' }, ...BASELINE_FACTION },
    MOUNTAINBORN: { id: 'MOUNTAINBORN', name: 'Mountainborn',     tagline: 'Heavy armor.',         color: '#55E04A', palette: { light: '#A5EF9F', base: '#55E04A', dark: '#208B18', shadow: '#0E3D0A' }, ...BASELINE_FACTION },
    VESPID:       { id: 'VESPID',       name: 'Vespid Swarm',     tagline: 'Swarm forces.',        color: '#FFD21F', palette: { light: '#FFE88F', base: '#FFD21F', dark: '#A38200', shadow: '#473900' }, ...BASELINE_FACTION },
    PROTOCOL:     { id: 'PROTOCOL',     name: 'Protocol Zero',    tagline: 'Precision snipers.',   color: '#FF2A2A', palette: { light: '#FF8585', base: '#FF2A2A', dark: '#AD0000', shadow: '#4D0000' }, ...BASELINE_FACTION },
    STATIC:       { id: 'STATIC',       name: 'Static Syndicate', tagline: 'Aggressive brawlers.', color: '#FF2BB8', palette: { light: '#FF8AD8', base: '#FF2BB8', dark: '#AD0074', shadow: '#4D0033' }, ...BASELINE_FACTION },
    CROWN:        { id: 'CROWN',        name: 'Violet Crown',     tagline: 'Fortress defense.',    color: '#7A2CFF', palette: { light: '#BF99FF', base: '#7A2CFF', dark: '#4400B8', shadow: '#1E0052' }, ...BASELINE_FACTION }
};

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

        let factionKey = null;
        if (gameManager && gameManager.factionMap) {
            factionKey = gameManager.factionMap[ownerId];
        }

        if (!factionKey) {
            factionKey = ownerId === 1 ? 'REMNANTS' : 'PROTOCOL';
        }

        if (typeof factionKey === 'string') {
            factionKey = factionKey.toUpperCase();
        }

        return FACTION_DATA[factionKey] || FACTION_DATA.REMNANTS;
    }

    static getColor(ownerId, gameManager) {
        return this.getFaction(ownerId, gameManager).color;
    }

    static getPalette(ownerId, gameManager) {
        return this.getFaction(ownerId, gameManager).palette;
    }
}