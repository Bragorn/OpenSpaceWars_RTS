const canvas = document.getElementById('game');
const ctx = canvas ? canvas.getContext('2d') : null;

function setupCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
setupCanvas();
window.addEventListener('resize', setupCanvas);

// Global instance setup
const gameManager = new GameManager();
window.gameManager = gameManager;

// System initialization
const controls = new Controls(canvas, gameManager, 1);
const renderer = new Renderer(canvas, ctx);

gameManager.controls = controls;
gameManager.renderer = renderer;

// Game Over Modal listener
const gameOverModal = document.getElementById('game-over-modal');
const btnRestart = document.getElementById('btn-restart');

if (btnRestart) {
    btnRestart.addEventListener('click', () => {
        if (gameOverModal) gameOverModal.classList.add('hidden');
        if (gameManager.currentMapData) {
            gameManager.start(gameManager.currentMapData);
        }
    });
}