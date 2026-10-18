const canvas = document.getElementById('game');

function setupCanvas() {
    if (!canvas) return;
    Viewport.update(canvas);
}

setupCanvas();
window.addEventListener('resize', setupCanvas);

// Global instance setup (GameManager creates its own Renderer and Controls)
const gameManager = new GameManager();
window.gameManager = gameManager;

AudioManager.init();