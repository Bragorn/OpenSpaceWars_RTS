const VIRTUAL_SIZE = 800; // Fixed internal logical coordinate space

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

// Map layout designed for an 800x800 coordinate grid
const LEVEL_SETUP = (cx, cy) => [
    // Starting Player & AI Home Bases
    { x: cx - 260, y: cy, level: 1, owner: 1 }, // Player Start (Left)
    { x: cx + 260, y: cy, level: 1, owner: 2 }, // AI Start (Right)

    // Central Strategic Outpost (Replaces the Sun)
    { x: cx, y: cy, level: 2, owner: 0 },

    // Inner Vertical Chokepoints
    { x: cx - 100, y: cy - 180, level: 1, owner: 0 },
    { x: cx + 100, y: cy - 180, level: 1, owner: 0 },
    { x: cx - 100, y: cy + 180, level: 1, owner: 0 },
    { x: cx + 100, y: cy + 180, level: 1, owner: 0 },

    // Outer Flanking Nodes
    { x: cx - 280, y: cy - 240, level: 1, owner: 0 },
    { x: cx + 280, y: cy - 240, level: 1, owner: 0 },
    { x: cx - 280, y: cy + 240, level: 1, owner: 0 },
    { x: cx + 280, y: cy + 240, level: 1, owner: 0 }
];