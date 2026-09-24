const OWNER_COLORS = {
    0: '#666677',
    1: '#00d2ff',
    2: '#ff3366'
};

const TIER_STATS = {
    1: { radius: 13, maxHP: 10, spawnInterval: 3.5, upgradeCost: 10 },
    2: { radius: 18, maxHP: 20, spawnInterval: 2.2, upgradeCost: 20 },
    3: { radius: 24, maxHP: 30, spawnInterval: 1.2, upgradeCost: 0 }
};

const LEVELS = [
    {
        name: "Level 1 - Balanced Skirmish",
        setup: (cx, cy, r) => [
            { x: cx - r, y: cy, level: 1, owner: 1 },
            { x: cx + r, y: cy, level: 1, owner: 2 },
            { x: cx - r * 0.5, y: cy - r * 0.5, level: 1, owner: 0 },
            { x: cx + r * 0.5, y: cy - r * 0.5, level: 1, owner: 0 },
            { x: cx - r * 0.5, y: cy + r * 0.5, level: 1, owner: 0 },
            { x: cx + r * 0.5, y: cy + r * 0.5, level: 1, owner: 0 }
        ]
    },
    {
        name: "Level 2 - Central Bottleneck",
        setup: (cx, cy, r) => [
            { x: cx - r, y: cy, level: 1, owner: 1 },
            { x: cx + r, y: cy, level: 1, owner: 2 },
            { x: cx,     y: cy, level: 1, owner: 0 },
            { x: cx - r * 0.4, y: cy - r * 0.6, level: 1, owner: 0 },
            { x: cx + r * 0.4, y: cy - r * 0.6, level: 1, owner: 0 },
            { x: cx - r * 0.4, y: cy + r * 0.6, level: 1, owner: 0 },
            { x: cx + r * 0.4, y: cy + r * 0.6, level: 1, owner: 0 }
        ]
    },
    {
        name: "Level 3 - AI Fortress Siege",
        setup: (cx, cy, r) => [
            { x: cx - r * 0.8, y: cy - r * 0.4, level: 1, owner: 1 },
            { x: cx - r * 0.8, y: cy + r * 0.4, level: 1, owner: 1 },
            { x: cx - r * 0.4, y: cy,           level: 1, owner: 1 },
            { x: cx + r * 0.7, y: cy,           level: 2, owner: 2 },
            { x: cx,           y: cy - r * 0.5, level: 1, owner: 0 },
            { x: cx,           y: cy + r * 0.5, level: 1, owner: 0 }
        ]
    },
    {
        name: "Level 4 - Twin Orbit Rings",
        setup: (cx, cy, r) => [
            { x: cx - r, y: cy, level: 1, owner: 1 },
            { x: cx + r, y: cy, level: 1, owner: 2 },
            { x: cx - r * 0.3, y: cy - r * 0.4, level: 1, owner: 0 },
            { x: cx + r * 0.3, y: cy - r * 0.4, level: 1, owner: 0 },
            { x: cx - r * 0.3, y: cy + r * 0.4, level: 1, owner: 0 },
            { x: cx + r * 0.3, y: cy + r * 0.4, level: 1, owner: 0 }
        ]
    },
    {
        name: "Level 5 - Deep Space Highway",
        setup: (cx, cy, r) => [
            { x: cx - r * 0.9, y: cy, level: 1, owner: 1 },
            { x: cx + r * 0.9, y: cy, level: 1, owner: 2 },
            { x: cx - r * 0.4, y: cy, level: 1, owner: 0 },
            { x: cx,           y: cy, level: 2, owner: 0 },
            { x: cx + r * 0.4, y: cy, level: 1, owner: 0 }
        ]
    }
];