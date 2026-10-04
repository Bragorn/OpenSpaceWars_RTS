const GAME_MAPS = [
    {
        id: 1,
        name: "Central Fortress",
        description: "Classic layout with a contested centerpiece planet flanked by outlying outposts.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.30, ny: 0.25, level: 1, owner: 0 }, // Neutral North
            { nx: 0.30, ny: 0.75, level: 1, owner: 0 }, // Neutral South
            { nx: 0.50, ny: 0.50, level: 1, owner: 0 }, // Center Fortress
            { nx: 0.70, ny: 0.25, level: 1, owner: 0 }, // Neutral North
            { nx: 0.70, ny: 0.75, level: 1, owner: 0 }, // Neutral South
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 2,
        name: "The Gauntlet",
        description: "Tight linear frontline pushing directly through center, with high-risk flank paths.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.32, ny: 0.50, level: 1, owner: 0 }, // West Buffer
            { nx: 0.50, ny: 0.50, level: 1, owner: 0 }, // Center Choke
            { nx: 0.50, ny: 0.18, level: 1, owner: 0 }, // Top Flank
            { nx: 0.50, ny: 0.82, level: 1, owner: 0 }, // Bottom Flank
            { nx: 0.68, ny: 0.50, level: 1, owner: 0 }, // East Buffer
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 3,
        name: "Twin Atolls",
        description: "Two distinct home clusters separated by a wide central void and mid-point bridge.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.25, ny: 0.25, level: 1, owner: 0 }, // Player Island North
            { nx: 0.25, ny: 0.75, level: 1, owner: 0 }, // Player Island South
            { nx: 0.50, ny: 0.50, level: 1, owner: 0 }, // Central Gate Bridge
            { nx: 0.75, ny: 0.25, level: 1, owner: 0 }, // AI Island North
            { nx: 0.75, ny: 0.75, level: 1, owner: 0 }, // AI Island South
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 4,
        name: "The Hourglass",
        description: "Split-front map forcing players to manage top and bottom bottlenecks simultaneously.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.25, ny: 0.20, level: 1, owner: 0 }, // Player Rear North
            { nx: 0.25, ny: 0.80, level: 1, owner: 0 }, // Player Rear South
            { nx: 0.50, ny: 0.30, level: 1, owner: 0 }, // Top Chokepoint
            { nx: 0.50, ny: 0.70, level: 1, owner: 0 }, // Bottom Chokepoint
            { nx: 0.75, ny: 0.20, level: 1, owner: 0 }, // AI Rear North
            { nx: 0.75, ny: 0.80, level: 1, owner: 0 }, // AI Rear South
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 5,
        name: "Orbital Ring",
        description: "Wide circular ring arrangement requiring long-range transit management.",
        planets: [
            { nx: 0.12, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.30, ny: 0.25, level: 1, owner: 0 }, // Outer North
            { nx: 0.30, ny: 0.75, level: 1, owner: 0 }, // Outer South
            { nx: 0.50, ny: 0.15, level: 1, owner: 0 }, // Top Apex
            { nx: 0.50, ny: 0.85, level: 1, owner: 0 }, // Bottom Apex
            { nx: 0.70, ny: 0.25, level: 1, owner: 0 }, // Outer North
            { nx: 0.70, ny: 0.75, level: 1, owner: 0 }, // Outer South
            { nx: 0.88, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    }
];

class MapRegistry {
    constructor() {
        this.maps = GAME_MAPS;
    }

    getAllMaps() {
        return this.maps;
    }

    getMap(slotNum) {
        const index = Math.max(0, parseInt(slotNum, 10) - 1);
        return this.maps[index] || this.maps[0];
    }

    getScaledMap(slotNum, width, height) {
        const rawMap = this.getMap(slotNum);
        const paddingX = 80;
        const paddingY = 80;
        const usableWidth = Math.max(300, width - paddingX * 2);
        const usableHeight = Math.max(300, height - paddingY * 2);

        return {
            ...rawMap,
            planets: rawMap.planets.map(p => ({
                x: Math.round(paddingX + (p.nx !== undefined ? p.nx * usableWidth : p.x)),
                y: Math.round(paddingY + (p.ny !== undefined ? p.ny * usableHeight : p.y)),
                level: 1, // Enforces Level 1 across all initial planet spawns
                owner: p.owner
            }))
        };
    }
}