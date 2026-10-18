class Controls {
    constructor(canvas, gameManager, playerOwner = 1) {
        // Parameter safety guard: check if canvas was omitted or passed second
        if (canvas && !(canvas instanceof HTMLElement) && canvas.planets) {
            gameManager = canvas;
            canvas = document.getElementById('game');
        } else if (!canvas || !(canvas instanceof HTMLElement)) {
            canvas = document.getElementById('game');
        }

        this.canvas = canvas;
        this.gameManager = gameManager;
        this.playerOwner = playerOwner;
        this.enabled = true; // false in spectator mode

        this.dragStartPlanet = null;
        this.isDragging = false;
        this.currentMousePos = { x: 0, y: 0 };

        if (this.canvas) {
            this.setupListeners();
        } else {
            console.error("Controls: Could not find canvas element!");
        }
    }

    reset() {
        this.dragStartPlanet = null;
        this.isDragging = false;
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        return Viewport.toWorld(clientX - rect.left, clientY - rect.top);
    }

    getPlanetAtPos(pos) {
        if (!this.gameManager || !this.gameManager.planets) return null;
        for (let planet of this.gameManager.planets) {
            const dx = planet.x - pos.x;
            const dy = planet.y - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) <= planet.radius + 16) {
                return planet;
            }
        }
        return null;
    }

    setupListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.enabled) return;
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
            if (this.enabled && this.isDragging && this.dragStartPlanet) {
                const targetPlanet = this.getPlanetAtPos(this.currentMousePos);
                if (targetPlanet && targetPlanet !== this.dragStartPlanet) {
                    if (typeof this.gameManager.dispatchFleet === 'function') {
                        this.gameManager.dispatchFleet(this.dragStartPlanet, targetPlanet, window.GAME_CONFIG.PLAYER_FLEET_RATIO);
                    }
                }
            }
            this.reset();
        });

        this.canvas.addEventListener('dblclick', (e) => {
            if (!this.enabled) return;
            const pos = this.getCanvasPos(e);
            const planet = this.getPlanetAtPos(pos);
            if (planet && planet.owner === this.playerOwner && typeof planet.startUpgrade === 'function') {
                planet.startUpgrade(this.gameManager.ships);
            }
        });
    }

    draw(ctx) {
        if (!this.enabled) return;
        if (this.isDragging && this.dragStartPlanet) {
            ctx.beginPath();
            ctx.moveTo(this.dragStartPlanet.x, this.dragStartPlanet.y);
            ctx.lineTo(this.currentMousePos.x, this.currentMousePos.y);
            ctx.strokeStyle = FactionManager.getColor(this.playerOwner, this.gameManager);
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}