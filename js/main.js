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

let lastTime = performance.now();

function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    gameManager.update(dt);
    aiController.update(dt);
    renderer.render(gameManager, controls);

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);