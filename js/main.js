const canvas = document.getElementById('game');

function setupCanvas() {
    if (!canvas) return;
    Viewport.update(canvas);
}

setupCanvas();
window.addEventListener('resize', setupCanvas);

window.gameManager = new GameManager();

AudioManager.init();