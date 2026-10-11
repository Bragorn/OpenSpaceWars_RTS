const GAME_MAPS = [
    {
        id: 1,
        name: "Central Fortress",
        description: "Classic layout with a contested centerpiece planet flanked by outlying outposts.",
        planets: [
            { nx: 0.06, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.28, ny: 0.18, level: 1, owner: 0 }, // Neutral North
            { nx: 0.28, ny: 0.82, level: 1, owner: 0 }, // Neutral South
            { nx: 0.50, ny: 0.50, level: 1, owner: 0 }, // Center Fortress
            { nx: 0.72, ny: 0.18, level: 1, owner: 0 }, // Neutral North
            { nx: 0.72, ny: 0.82, level: 1, owner: 0 }, // Neutral South
            { nx: 0.94, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 2,
        name: "The Gauntlet",
        description: "Tight linear frontline pushing directly through center, with high-risk flank paths.",
        planets: [
            { nx: 0.06, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.28, ny: 0.50, level: 1, owner: 0 }, // West Buffer
            { nx: 0.50, ny: 0.50, level: 1, owner: 0 }, // Center Choke
            { nx: 0.50, ny: 0.12, level: 1, owner: 0 }, // Top Flank
            { nx: 0.50, ny: 0.88, level: 1, owner: 0 }, // Bottom Flank
            { nx: 0.72, ny: 0.50, level: 1, owner: 0 }, // East Buffer
            { nx: 0.94, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 3,
        name: "Twin Atolls",
        description: "Two distinct home clusters separated by a wide central void and mid-point bridge.",
        planets: [
            { nx: 0.06, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.22, ny: 0.18, level: 1, owner: 0 }, // Player Island North
            { nx: 0.22, ny: 0.82, level: 1, owner: 0 }, // Player Island South
            { nx: 0.50, ny: 0.50, level: 1, owner: 0 }, // Central Gate Bridge
            { nx: 0.78, ny: 0.18, level: 1, owner: 0 }, // AI Island North
            { nx: 0.78, ny: 0.82, level: 1, owner: 0 }, // AI Island South
            { nx: 0.94, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 4,
        name: "The Hourglass",
        description: "Split-front map forcing players to manage top and bottom bottlenecks simultaneously.",
        planets: [
            { nx: 0.06, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.24, ny: 0.15, level: 1, owner: 0 }, // Player Rear North
            { nx: 0.24, ny: 0.85, level: 1, owner: 0 }, // Player Rear South
            { nx: 0.50, ny: 0.28, level: 1, owner: 0 }, // Top Chokepoint
            { nx: 0.50, ny: 0.72, level: 1, owner: 0 }, // Bottom Chokepoint
            { nx: 0.76, ny: 0.15, level: 1, owner: 0 }, // AI Rear North
            { nx: 0.76, ny: 0.85, level: 1, owner: 0 }, // AI Rear South
            { nx: 0.94, ny: 0.50, level: 1, owner: 2 }  // AI Base
        ]
    },
    {
        id: 5,
        name: "Orbital Ring",
        description: "Wide circular ring arrangement requiring long-range transit management.",
        planets: [
            { nx: 0.06, ny: 0.50, level: 1, owner: 1 }, // Player Base
            { nx: 0.28, ny: 0.18, level: 1, owner: 0 }, // Outer North
            { nx: 0.28, ny: 0.82, level: 1, owner: 0 }, // Outer South
            { nx: 0.50, ny: 0.10, level: 1, owner: 0 }, // Top Apex
            { nx: 0.50, ny: 0.90, level: 1, owner: 0 }, // Bottom Apex
            { nx: 0.72, ny: 0.18, level: 1, owner: 0 }, // Outer North
            { nx: 0.72, ny: 0.82, level: 1, owner: 0 }, // Outer South
            { nx: 0.94, ny: 0.50, level: 1, owner: 2 }  // AI Base
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
        
        // Safety margin ensures planets don't clip canvas edges
        const marginX = 40;
        const marginY = 40;
        
        const usableWidth = Math.max(200, width - marginX * 2);
        const usableHeight = Math.max(200, height - marginY * 2);

        return {
            ...rawMap,
            planets: rawMap.planets.map(p => ({
                x: Math.round(marginX + (p.nx * usableWidth)),
                y: Math.round(marginY + (p.ny * usableHeight)),
                level: 1,
                owner: p.owner
            }))
        };
    }
}