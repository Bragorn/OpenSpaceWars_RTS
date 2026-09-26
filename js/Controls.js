class Controls {
    constructor(canvas, playerOwner = 1) {
        this.canvas = canvas;
        this.playerOwner = playerOwner;

        this.dragStartPlanet = null;
        this.isDragging = false;
        this.currentMousePos = { x: 0, y: 0 };

        this.setupListeners();
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        return {
            x: (clientX - rect.left) * (VIRTUAL_SIZE / rect.width),
            y: (clientY - rect.top) * (VIRTUAL_SIZE / rect.height)
        };
    }

    getPlanetAtPos(pos) {
        for (let planet of planets) {
            const dx = planet.x - pos.x;
            const dy = planet.y - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) <= planet.radius + 14) {
                return planet;
            }
        }
        return null;
    }

    setupListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            const pos = this.getCanvasPos(e);
            this.currentMousePos = pos;
            const planet = this.getPlanetAtPos(pos);
            if (planet && planet.owner === this.playerOwner) {
                this.dragStartPlanet = planet;
                this.isDragging = true;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.currentMousePos = this.getCanvasPos(e);
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging && this.dragStartPlanet) {
                const targetPlanet = this.getPlanetAtPos(this.currentMousePos);
                if (targetPlanet && targetPlanet !== this.dragStartPlanet) {
                    dispatchFleet(this.dragStartPlanet, targetPlanet, 0.5);
                }
            }
            this.isDragging = false;
            this.dragStartPlanet = null;
        });

        this.canvas.addEventListener('dblclick', (e) => {
            const pos = this.getCanvasPos(e);
            const planet = this.getPlanetAtPos(pos);
            if (planet && planet.owner === this.playerOwner) {
                planet.startLanding();
            }
        });
    }

    draw(ctx) {
        if (this.isDragging && this.dragStartPlanet) {
            ctx.beginPath();
            ctx.moveTo(this.dragStartPlanet.x, this.dragStartPlanet.y);
            ctx.lineTo(this.currentMousePos.x, this.currentMousePos.y);
            ctx.strokeStyle = OWNER_COLORS[this.playerOwner];
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}