const Viewport = {
    dpr: 1, scale: 1, offsetX: 0, offsetY: 0,

    update(canvas) {
        const cfg = window.GAME_CONFIG;
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
        this.dpr = window.devicePixelRatio || 1;

        canvas.width = Math.round(cssW * this.dpr);
        canvas.height = Math.round(cssH * this.dpr);

        this.scale = Math.min(cssW / cfg.WORLD_WIDTH, cssH / cfg.WORLD_HEIGHT);
        this.offsetX = (cssW - cfg.WORLD_WIDTH * this.scale) / 2;
        this.offsetY = (cssH - cfg.WORLD_HEIGHT * this.scale) / 2;
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
    }
};