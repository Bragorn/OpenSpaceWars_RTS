const Viewport = {
    dpr: 1, scale: 1, offsetX: 0, offsetY: 0, insetTop: 0,

    update(canvas) {
        const cfg = window.GAME_CONFIG;
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
        this.dpr = window.devicePixelRatio || 1;

        // Reserve room under the HUD bar while it is visible, so it never covers the map
        const hud = document.getElementById('hud-top-center');
        this.insetTop = (hud && !hud.classList.contains('hidden')) ? hud.offsetHeight : 0;

        canvas.width = Math.round(cssW * this.dpr);
        canvas.height = Math.round(cssH * this.dpr);

        const availH = Math.max(1, cssH - this.insetTop);
        this.scale = Math.min(cssW / cfg.WORLD_WIDTH, availH / cfg.WORLD_HEIGHT);
        this.offsetX = (cssW - cfg.WORLD_WIDTH * this.scale) / 2;
        this.offsetY = this.insetTop + (availH - cfg.WORLD_HEIGHT * this.scale) / 2;
    },

    apply(ctx) {
        const s = this.scale * this.dpr;
        ctx.setTransform(s, 0, 0, s, this.offsetX * this.dpr, this.offsetY * this.dpr);
    },

        toWorld(cssX, cssY) {
        return {
            x: (cssX - this.offsetX) / this.scale,
            y: (cssY - this.offsetY) / this.scale
        };
    },

    toScreen(wx, wy) {
        return {
            x: wx * this.scale + this.offsetX,
            y: wy * this.scale + this.offsetY
        };
    }
};