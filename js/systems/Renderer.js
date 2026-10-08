class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas && typeof canvas.getContext === 'function' ? canvas : document.getElementById('game');
        this.ctx = ctx || (this.canvas ? this.canvas.getContext('2d') : null);
    }

    render(gameManager, controls) {
        if (!this.canvas) this.canvas = document.getElementById('game');
        if (!this.ctx && this.canvas) this.ctx = this.canvas.getContext('2d');
        if (!this.ctx || !gameManager) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (controls && typeof controls.draw === 'function') {
            controls.draw(this.ctx);
        }

        // Draw Planets — pass gameManager as 3rd arg so planets use chosen faction colors
        if (Array.isArray(gameManager.planets)) {
            gameManager.planets.forEach(planet => {
                if (planet && typeof planet.draw === 'function') {
                    planet.draw(this.ctx, gameManager.ships, gameManager);
                }
            });
        }

        // Draw Flying Ships
        if (Array.isArray(gameManager.ships)) {
            for (let i = 0; i < gameManager.ships.length; i++) {
                const ship = gameManager.ships[i];
                if (ship) {
                    if (typeof ship.draw === 'function') ship.draw(this.ctx);
                    if (typeof ship.drawThrusters === 'function') ship.drawThrusters(this.ctx);
                }
            }
        }

        // In Renderer.render(gameManager, controls):
        if (typeof AIDebugRenderer !== 'undefined') {
            AIDebugRenderer.render(this.ctx, gameManager);
        }
    }
}