const GAME_CONFIG = {
    DEFAULT_SPEED: 1,
    
    SEND_RATIOS: [0.25, 0.5, 0.75, 1.0],   // keys 1-4
    DEFAULT_SEND_INDEX: 2,                 // starts at 75%

    SIM_STEP: 1 / 60,
    MAX_STEPS_PER_FRAME: 8,

    EXPLOSION_SECONDS: 1.5,
    DEATH_TOLL_PER_SHIP: 1000,

    WORLD_WIDTH: 1280,
    WORLD_HEIGHT: 720,

    PHYSICS: {
        SOI_RADIUS: 110,
        GRAV_CONST: 80000
    },
};

window.GAME_CONFIG = GAME_CONFIG;