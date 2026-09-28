const VIRTUAL_SIZE = 1000;
const arenaSize = VIRTUAL_SIZE;

const OWNER_COLORS = {
    0: '#ffffff', // Neutral
    1: '#0088ff', // Player Blue
    2: '#ff3355'  // AI Red
};

const TIER_STATS = {
    1: { radius: 28, maxHP: 10, spawnInterval: 3.0, upgradeCost: 10 },
    2: { radius: 38, maxHP: 20, spawnInterval: 1.8, upgradeCost: 20 },
    3: { radius: 50, maxHP: 30, spawnInterval: 0.9, upgradeCost: 0 }
};

const LEVEL_SETUP = (cx, cy) => [
    // Left Side (Player Territory)
    { x: cx - 340, y: cy, level: 1, owner: 1 },        // Player Base
    { x: cx - 210, y: cy - 220, level: 1, owner: 0 },  // Left Top Neutral
    { x: cx - 120, y: cy, level: 1, owner: 0 },        // Left Inner Neutral
    { x: cx - 210, y: cy + 220, level: 1, owner: 0 },  // Left Bottom Neutral

    // Right Side (Enemy Territory)
    { x: cx + 340, y: cy, level: 1, owner: 2 },        // Enemy Base
    { x: cx + 220, y: cy - 220, level: 1, owner: 0 },  // Right Top Neutral
    { x: cx + 120, y: cy, level: 1, owner: 0 },        // Right Inner Neutral
    { x: cx + 220, y: cy + 220, level: 1, owner: 0 }   // Right Bottom Neutral
];