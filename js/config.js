const OWNER_COLORS = {
    0: '#ffffff', // Neutral
    1: '#0088ff', // Player Blue
    2: '#ff3355'  // AI Red
};

const TIER_STATS = {
    1: { radius: 30, maxHP: 10, spawnInterval: 3.0, upgradeCost: 10 },
    2: { radius: 30, maxHP: 20, spawnInterval: 1.8, upgradeCost: 20 },
    3: { radius: 30, maxHP: 30, spawnInterval: 0.9, upgradeCost: 0 }
};

const LEVEL_SETUP = (width, height) => [
    // --- FACTION BASES (Tucked back safely) ---
    { x: width * 0.08, y: height * 0.50, level: 1, owner: 1 }, // Player Home
    { x: width * 0.92, y: height * 0.50, level: 1, owner: 2 }, // AI Home

    // --- SAFE POCKET EXPANSIONS (Close, easy early pickings) ---
    { x: width * 0.20, y: height * 0.25, level: 1, owner: 0 }, // Player Top Pocket
    { x: width * 0.20, y: height * 0.75, level: 1, owner: 0 }, // Player Bottom Pocket

    { x: width * 0.80, y: height * 0.25, level: 1, owner: 0 }, // AI Top Pocket
    { x: width * 0.80, y: height * 0.75, level: 1, owner: 0 }, // AI Bottom Pocket

    // --- THE CONTESTED CENTER (High Tier / High HP Fortress) ---
    { x: width * 0.50, y: height * 0.50, level: 2, owner: 0 }, // Central Core (Tier 2)

    // --- FLANK ROUTES (Open avenues for counter-attacks) ---
    { x: width * 0.50, y: height * 0.15, level: 1, owner: 0 }, // High Flank
    { x: width * 0.50, y: height * 0.85, level: 1, owner: 0 }  // Low Flank
];