class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    render(gameManager, controls) {
        this.ctx.clearRect(0, 0, VIRTUAL_SIZE, VIRTUAL_SIZE);

        if (controls) controls.draw(this.ctx);

        // Draw Planets
        gameManager.planets.forEach(planet => planet.draw(this.ctx, gameManager.ships));

        // Draw Ships
        for (let i = 0; i < gameManager.ships.length; i++) {
            gameManager.ships[i].draw(this.ctx);
            gameManager.ships[i].drawThrusters(this.ctx);
        }
    }
}