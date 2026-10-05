const GAME_CONFIG = {
    DEFAULT_SPEED: 1,
    MAX_SPEED: 3,
    DEFAULT_FLEET_RATIO: 0.5,
    
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

const TIER_STATS = {
    1: { radius: 30, maxHP: 10, spawnInterval: 3.0, upgradeCost: 10 },
    2: { radius: 30, maxHP: 20, spawnInterval: 1.8, upgradeCost: 20 },
    3: { radius: 30, maxHP: 30, spawnInterval: 0.9, upgradeCost: 0 }
};