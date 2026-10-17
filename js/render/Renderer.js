const THRUSTER_COLOR = '#FF8C1A';

// Explosion timeline: t = 0..1 of its life. Flash, then fire, then dark smoke, then gone.
const EXPLOSION_SCALE = 1.0; // multiplies every radius below
const EXPLOSION_FRAMES = [
    { t: 0.00, r: 2.5, rgb: [255, 255, 255], a: 1.0 },  // white flash starts
    { t: 0.06, r: 5.0, rgb: [255, 255, 255], a: 1.0 },  // peak flash
    { t: 0.25, r: 5.5, rgb: [255, 140, 26],  a: 0.95 }, // orange fire (same as thrusters)
    { t: 0.55, r: 6.0, rgb: [100, 45, 15],   a: 0.7 },  // dark brown
    { t: 1.00, r: 6.5, rgb: [30, 20, 15],    a: 0.0 }   // smoke fades out
];

class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas && typeof canvas.getContext === 'function' ? canvas : document.getElementById('game');
        this.ctx = ctx || (this.canvas ? this.canvas.getContext('2d') : null);
    }

    render(gameManager, controls) {
        if (!this.canvas) this.canvas = document.getElementById('game');
        if (!this.ctx && this.canvas) this.ctx = this.canvas.getContext('2d');
        if (!this.ctx || !gameManager) return;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        Viewport.apply(this.ctx);

        if (controls && typeof controls.draw === 'function') {
            controls.draw(this.ctx);
        }

        this.drawPlanets(gameManager);
        this.drawShips(gameManager.ships, gameManager);
        this.drawExplosions(gameManager);
        this.drawPlanetLabels(gameManager);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ================= PLANETS =================

    drawPlanets(gameManager) {
        if (!Array.isArray(gameManager.planets)) return;
        const ctx = this.ctx;

        for (const planet of gameManager.planets) {
            if (!planet) continue;
            ctx.beginPath();
            ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
            ctx.fillStyle = FactionManager.getColor(planet.owner, gameManager);
            ctx.fill();
        }
    }

    // Labels are drawn in screen space at a fixed size so the text stays crisp at any zoom
    drawPlanetLabels(gameManager) {
        if (!Array.isArray(gameManager.planets)) return;
        const dpr = Viewport.dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        for (const planet of gameManager.planets) {
            if (!planet) continue;
            const p = Viewport.toScreen(planet.x, planet.y);
            this.drawPlanetLabel(planet, gameManager, Math.round(p.x * dpr) / dpr, Math.round(p.y * dpr) / dpr);
        }
    }

    drawPlanetLabel(planet, gameManager, sx, sy) {
        const ctx = this.ctx;
        const maxTier = planet.getMaxTier();

        const lines = [
            `Ships: ${planet.getOrbitingShipsCount(gameManager)}`,
            `Lvl: ${planet.level}/${maxTier}`
        ];

        if (planet.owner !== 0) {
            lines.push(`HP: ${Math.ceil(planet.hp)}/${planet.maxHp}`);
            const upgCost = planet.getUpgradeCost();
            if (planet.level < maxTier && upgCost > 0) {
                lines.push(`Upg: ${Math.floor(planet.upgradeProgress)}/${upgCost}`);
            }
        } else {
            lines.push(`Cap: ${Math.floor(planet.upgradeProgress)}/${planet.claimCost}`);
        }

        const fontSize = 9;
        const lineHeight = 11;
        const startY = sy - (lines.length * lineHeight) / 2 + fontSize / 2;

        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], Math.round(sx), Math.round(startY + i * lineHeight));
        }
        ctx.restore();
    }

    // ================= SHIPS =================

    drawShips(ships, gameManager) {
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

        // Queued-to-depart outline: steady thin white outline around the hull while waiting for the window.
        // Shown for your own ships (both teams in spectator mode).
        const showAll = !gameManager || gameManager.gameMode === 'CPU_VS_CPU';
        let anyQueued = false;
        ctx.beginPath();
        for (const list of byColor.values()) {
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                if (s.state !== 'launching' || s.burning) continue;
                if (!showAll && s.owner !== 1) continue;
                const c = Math.cos(s.heading);
                const n = Math.sin(s.heading);
                ctx.moveTo(s.x + 3.5 * c,           s.y + 3.5 * n);
                ctx.lineTo(s.x - 2.5 * c + 2.0 * n, s.y - 2.5 * n - 2.0 * c);
                ctx.lineTo(s.x - 1.0 * c,           s.y - 1.0 * n);
                ctx.lineTo(s.x - 2.5 * c - 2.0 * n, s.y - 2.5 * n + 2.0 * c);
                ctx.closePath();
                anyQueued = true;
            }
        }
        if (anyQueued) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2.4;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        // Hulls: one fill per faction
        for (const [color, list] of byColor) {
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                const c = Math.cos(s.heading);
                const n = Math.sin(s.heading);
                // Local points (3.5,0) (-2.5,-2) (-1,0) (-2.5,2), rotated by heading
                ctx.moveTo(s.x + 3.5 * c,           s.y + 3.5 * n);
                ctx.lineTo(s.x - 2.5 * c + 2.0 * n, s.y - 2.5 * n - 2.0 * c);
                ctx.lineTo(s.x - 1.0 * c,           s.y - 1.0 * n);
                ctx.lineTo(s.x - 2.5 * c - 2.0 * n, s.y - 2.5 * n + 2.0 * c);
                ctx.closePath();
            }
            ctx.fill();
        }

        // Thruster plumes: one fill, same bright orange for every faction
        let anyPlume = false;
        ctx.beginPath();
        for (const list of byColor.values()) {
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                if (s.thrustRatio <= 0.05) continue;
                const px = s.x - Math.cos(s.heading) * 3.0;
                const py = s.y - Math.sin(s.heading) * 3.0;
                const r = 0.8 + s.thrustRatio * 1.0;
                ctx.moveTo(px + r, py);
                ctx.arc(px, py, r, 0, Math.PI * 2);
                anyPlume = true;
            }
        }
        if (anyPlume) {
            ctx.fillStyle = THRUSTER_COLOR;
            ctx.fill();
        }
    }

    // ================= SHIP EXPLOSIONS =================

    drawExplosions(gameManager) {
    const list = gameManager.explosions;
    if (!list || list.length === 0) return;
    const ctx = this.ctx;
    const dur = window.GAME_CONFIG.EXPLOSION_SECONDS;
    const F = EXPLOSION_FRAMES;

    for (const e of list) {
        const t = Math.min(1, e.age / dur);
        let i = 1;
        while (i < F.length - 1 && t > F[i].t) i++;
        const a = F[i - 1], b = F[i];
        const k = (t - a.t) / (b.t - a.t);
        const mix = (x, y) => x + (y - x) * k;

        const r = mix(a.r, b.r) * EXPLOSION_SCALE;
        const red = Math.round(mix(a.rgb[0], b.rgb[0]));
        const green = Math.round(mix(a.rgb[1], b.rgb[1]));
        const blue = Math.round(mix(a.rgb[2], b.rgb[2]));

        ctx.globalAlpha = mix(a.a, b.a);
        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}
}