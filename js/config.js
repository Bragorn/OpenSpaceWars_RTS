const VIRTUAL_SIZE = 800; // Fixed internal logical coordinate space
const arenaSize = VIRTUAL_SIZE

const OWNER_COLORS = {
    0: '#ffffff', // Neutral White
    1: '#0088ff', // Player Blue
    2: '#ff3355'  // AI Red
};

const TIER_STATS = {
    1: { radius: 18, maxHP: 10, spawnInterval: 3.0, upgradeCost: 10 },
    2: { radius: 26, maxHP: 20, spawnInterval: 1.8, upgradeCost: 20 },
    3: { radius: 34, maxHP: 30, spawnInterval: 0.9, upgradeCost: 0 }
};


const LEVEL_SETUP = (cx, cy) => [
    { x: cx - 260, y: cy, level: 1, owner: 1 },        // Player Base
    { x: cx - 180, y: cy - 160, level: 1, owner: 0 },  // Left Top Neutral
    { x: cx - 110, y: cy, level: 1, owner: 0 },        // Left Inner Neutral
    { x: cx - 180, y: cy + 160, level: 1, owner: 0 },  // Left Bottom Neutral

    // Right Side (Enemy Territory)
    { x: cx + 260, y: cy, level: 1, owner: 2 },        // Enemy Base
    { x: cx + 180, y: cy - 160, level: 1, owner: 0 },  // Right Top Neutral
    { x: cx + 110, y: cy, level: 1, owner: 0 },        // Right Inner Neutral
    { x: cx + 180, y: cy + 160, level: 1, owner: 0 }   // Right Bottom Neutral
];