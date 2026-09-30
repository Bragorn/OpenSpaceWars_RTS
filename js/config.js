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

const LEVEL_SETUP = (width, height) => [
    // --- FACTION BASES (Far Left / Far Right) ---
    { x: width * 0.12, y: height * 0.50, level: 1, owner: 1 }, // Player Home Base
    { x: width * 0.88, y: height * 0.50, level: 1, owner: 2 }, // Enemy Home Base

    // --- LEFT FLANK NEUTRALS ---
    { x: width * 0.28, y: height * 0.25, level: 1, owner: 0 }, // Player Upper Flank
    { x: width * 0.28, y: height * 0.75, level: 1, owner: 0 }, // Player Lower Flank

    // --- CENTER BATTLEGROUND NEUTRALS ---
    { x: width * 0.50, y: height * 0.22, level: 1, owner: 0 }, // Center High
    { x: width * 0.50, y: height * 0.50, level: 1, owner: 0 }, // Central Core Planet
    { x: width * 0.50, y: height * 0.78, level: 1, owner: 0 }, // Center Low

    // --- RIGHT FLANK NEUTRALS ---
    { x: width * 0.72, y: height * 0.25, level: 1, owner: 0 }, // Enemy Upper Flank
    { x: width * 0.72, y: height * 0.75, level: 1, owner: 0 }  // Enemy Lower Flank
];