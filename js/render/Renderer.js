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

        this.drawShips(gameManager.ships);
    }

    drawShips(ships) {
    if (!Array.isArray(ships) || ships.length === 0) return;
    const ctx = this.ctx;

    // Group live ships by faction color
    const byColor = new Map();
    for (let i = 0; i < ships.length; i++) {
        const s = ships[i];
        if (!s || s.dead || isNaN(s.x) || isNaN(s.y)) continue;
        let list = byColor.get(s.color);
        if (!list) { list = []; byColor.set(s.color, list); }
        list.push(s);
    }

    // Lasers: one stroke per faction
    ctx.lineWidth = 1.2;
    for (const [color, list] of byColor) {
        let any = false;
        ctx.beginPath();
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.laserTimer > 0 && s.laserTarget) {
                ctx.moveTo(s.x + Math.cos(s.heading) * 3.5, s.y + Math.sin(s.heading) * 3.5);
                ctx.lineTo(s.laserTarget.x, s.laserTarget.y);
                any = true;
            }
        }
        if (any) {
            ctx.strokeStyle = color;
            ctx.stroke();
        }
    }

    // Hulls: one fill per faction
    for (const [color, list] of byColor) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            const c = Math.cos(s.heading);
            const n = Math.sin(s.heading);
            // Local points: (3.5,0) (-2.5,-2) (-1,0) (-2.5,2), rotated by heading
            ctx.moveTo(s.x + 3.5 * c,              s.y + 3.5 * n);
            ctx.lineTo(s.x - 2.5 * c + 2.0 * n,    s.y - 2.5 * n - 2.0 * c);
            ctx.lineTo(s.x - 1.0 * c,              s.y - 1.0 * n);
            ctx.lineTo(s.x - 2.5 * c - 2.0 * n,    s.y - 2.5 * n + 2.0 * c);
            ctx.closePath();
        }
        ctx.fill();
    }

    // Thruster plumes: one fill per plume color
    const plumeColors = ['#66ccff', '#ffaa11']; // low thrust, high thrust
    for (let pass = 0; pass < 2; pass++) {
        let any = false;
        ctx.beginPath();
        for (const list of byColor.values()) {
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                if (s.thrustRatio <= 0.05) continue;
                if ((s.thrustRatio > 0.5 ? 1 : 0) !== pass) continue;
                const px = s.x - Math.cos(s.heading) * 3.0;
                const py = s.y - Math.sin(s.heading) * 3.0;
                const r = 0.8 + s.thrustRatio * 1.0;
                ctx.moveTo(px + r, py);
                ctx.arc(px, py, r, 0, Math.PI * 2);
                any = true;
            }
        }
        if (any) {
            ctx.fillStyle = plumeColors[pass];
            ctx.fill();
        }
    }
}
}