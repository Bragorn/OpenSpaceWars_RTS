const GAME_CONFIG = {
    DEFAULT_SPEED: 1,
    MAX_SPEED: 3,
    DEFAULT_FLEET_RATIO: 0.5,

    SIM_STEP: 1 / 60,
    MAX_STEPS_PER_FRAME: 8,
    MAX_MATCH_SECONDS: 600,
    EXPLOSION_SECONDS: 1.5,
    DEATH_TOLL_PER_SHIP: 1000,

    WORLD_WIDTH: 1280,
    WORLD_HEIGHT: 720,

    PHYSICS: {
        SOI_RADIUS: 110,
        GRAV_CONST: 80000
    },

    DOM: {
        CANVAS_ID: 'game',
        HUD_ID: 'hud',
        TIMER_ID: 'game-timer',
        BTN_PLAY_PAUSE: 'btn-play-pause',
        BTN_SPEED_1: 'btn-speed-1',
        BTN_SPEED_2: 'btn-speed-2',
        BTN_SPEED_3: 'btn-speed-3',
        GAME_OVER_MODAL: 'game-over-modal',
        GAME_OVER_TITLE: 'game-over-title',
        GAME_OVER_MSG: 'game-over-msg'
    }
};

window.GAME_CONFIG = GAME_CONFIG;