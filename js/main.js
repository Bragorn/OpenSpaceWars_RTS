const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function setupCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
setupCanvas();

window.addEventListener('resize', setupCanvas);

const gameManager = new GameManager();
gameManager.init();

const controls = new Controls(canvas, gameManager, 1);
const aiController = new AIController(gameManager, 2);
const renderer = new Renderer(canvas, ctx);

// --- UI Elements & Speed Controls ---
const timerEl = document.getElementById('timer');
const gameOverModal = document.getElementById('game-over-modal');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverMsg = document.getElementById('game-over-msg');
const btnRestart = document.getElementById('btn-restart');

const speedButtons = {
    0: document.getElementById('btn-pause'),
    1: document.getElementById('btn-1x'),
    2: document.getElementById('btn-2x'),
    3: document.getElementById('btn-3x')
};

function setGameSpeed(speed) {
    gameManager.gameSpeed = speed;
    Object.keys(speedButtons).forEach(s => {
        if (parseInt(s) === speed) {
            speedButtons[s].classList.add('active');
        } else {
            speedButtons[s].classList.remove('active');
        }
    });
}

Object.keys(speedButtons).forEach(speed => {
    speedButtons[speed].addEventListener('click', () => setGameSpeed(parseInt(speed)));
});

btnRestart.addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    gameManager.init();
    setGameSpeed(1);
});

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- Main Loop ---
let lastTime = performance.now();

function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    gameManager.update(dt);

    if (gameManager.gameSpeed > 0 && !gameManager.gameOver) {
        aiController.update(dt * gameManager.gameSpeed);
    }

    renderer.render(gameManager, controls);

    // Update Timer Text
    timerEl.textContent = formatTime(gameManager.gameTime);

    // Handle Game Over UI Trigger
    if (gameManager.gameOver && gameOverModal.classList.contains('hidden')) {
        gameOverModal.classList.remove('hidden');
        if (gameManager.winner === 1) {
            gameOverTitle.textContent = "VICTORY!";
            gameOverTitle.style.color = "#0088ff";
            gameOverMsg.textContent = "You have eliminated all enemy forces!";
        } else {
            gameOverTitle.textContent = "DEFEAT";
            gameOverTitle.style.color = "#ff3355";
            gameOverMsg.textContent = "Your fleet has been completely destroyed.";
        }
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);