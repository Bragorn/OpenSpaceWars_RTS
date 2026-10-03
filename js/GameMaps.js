const Game_Maps = [
    {
        id: 1,
        name: "Direct Blitz",
        description: "Small map. Quick frontline engagement with two low-level neutral buffers.",
        planets: [
            { nx: 0.15, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.40, ny: 0.35, level: 1, owner: 0 }, // Neutral
            { nx: 0.40, ny: 0.65, level: 1, owner: 0 }, // Neutral
            { nx: 0.85, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 2,
        name: "Central Fortress",
        description: "High-value Level 3 neutral in the center. Flanked by small neutral outposts.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.30, ny: 0.25, level: 1, owner: 0 }, // Neutral North
            { nx: 0.30, ny: 0.75, level: 1, owner: 0 }, // Neutral South
            { nx: 0.50, ny: 0.50, level: 3, owner: 0 }, // Fortress Center
            { nx: 0.70, ny: 0.25, level: 1, owner: 0 }, // Neutral North
            { nx: 0.70, ny: 0.75, level: 1, owner: 0 }, // Neutral South
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 3,
        name: "Twin Pass",
        description: "Two distinct attack lanes separated by neutral planets.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.25, ny: 0.30, level: 1, owner: 1 }, // Player Expansion
            { nx: 0.50, ny: 0.25, level: 2, owner: 0 }, // North Choke
            { nx: 0.50, ny: 0.75, level: 2, owner: 0 }, // South Choke
            { nx: 0.75, ny: 0.70, level: 1, owner: 2 }, // AI Expansion
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 4,
        name: "Asymmetrical Choke",
        description: "Defensive stronghold on one side vs fast neutral access on the other.",
        planets: [
            { nx: 0.15, ny: 0.25, level: 2, owner: 1 }, // Player Base
            { nx: 0.15, ny: 0.75, level: 1, owner: 1 }, // Player Pocket
            { nx: 0.45, ny: 0.50, level: 1, owner: 0 }, // Mid Choke
            { nx: 0.65, ny: 0.30, level: 1, owner: 0 }, // Neutral
            { nx: 0.65, ny: 0.70, level: 1, owner: 0 }, // Neutral
            { nx: 0.85, ny: 0.50, level: 2, owner: 2 }  // AI Base
        ]
    },
    {
        id: 5,
        name: "Orbital Ring",
        description: "Ring arrangement requiring advance fleet scouting.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.30, ny: 0.25, level: 1, owner: 0 }, // Outer North
            { nx: 0.30, ny: 0.75, level: 1, owner: 0 }, // Outer South
            { nx: 0.50, ny: 0.15, level: 2, owner: 0 }, // Top Apex
            { nx: 0.50, ny: 0.85, level: 2, owner: 0 }, // Bottom Apex
            { nx: 0.70, ny: 0.25, level: 1, owner: 0 }, // Outer North
            { nx: 0.70, ny: 0.75, level: 1, owner: 0 }, // Outer South
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    }
];

// Resolves normalized positions to target pixel coordinates with edge padding
function buildScaledLevel(levelIndex, width, height) {
    const rawLevel = GAME_LEVELS[levelIndex] || GAME_LEVELS[0];
    const paddingX = 80;
    const paddingY = 80;
    const usableWidth = Math.max(300, width - paddingX * 2);
    const usableHeight = Math.max(300, height - paddingY * 2);

    return {
        ...rawLevel,
        planets: rawLevel.planets.map(p => ({
            x: Math.round(paddingX + (p.nx !== undefined ? p.nx * usableWidth : p.x)),
            y: Math.round(paddingY + (p.ny !== undefined ? p.ny * usableHeight : p.y)),
            level: p.level,
            owner: p.owner
        }))
    };
}