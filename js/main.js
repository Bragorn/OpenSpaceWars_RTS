const canvas = document.getElementById('game');
const ctx = canvas ? canvas.getContext('2d') : null;

function setupCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
setupCanvas();
window.addEventListener('resize', setupCanvas);

// Global instance setup (GameManager creates its own Renderer and Controls)
const gameManager = new GameManager();
window.gameManager = gameManager;