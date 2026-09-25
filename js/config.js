const OWNER_COLORS = {
    0: '#666677',
    1: '#00d2ff',
    2: '#ff3366'
};

const TIER_STATS = {
    1: { radius: 13, maxHP: 10, spawnInterval: 3.5, upgradeCost: 10 },
    2: { radius: 18, maxHP: 20, spawnInterval: 2.2, upgradeCost: 20 },
    3: { radius: 24, maxHP: 30, spawnInterval: 1.0, upgradeCost: 0 }
};

const SUN_CONFIG = {
    radius: 32,
    color: '#ffaa00'
};

const LEVELS = [
    {
        name: "Level 1 - Solar System",
        setup: (cx, cy, r) => [
            // Player 1 (Left) & Player 2 (Right) - Mid Orbit
            { x: cx - r * 0.65, y: cy, level: 1, owner: 1 },
            { x: cx + r * 0.65, y: cy, level: 1, owner: 2 },

            // Inner Ring (Fast neutral planets)
            { x: cx, y: cy - r * 0.35, level: 1, owner: 0 },
            { x: cx, y: cy + r * 0.35, level: 1, owner: 0 },

            // Outer Ring (Slow, valuable Tier-2 neutral planets)
            { x: cx + r * 0.9, y: cy - r * 0.4, level: 2, owner: 0 },
            { x: cx - r * 0.9, y: cy + r * 0.4, level: 2, owner: 0 }
        ]
    }
];