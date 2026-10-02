class MapEditor {
    constructor(canvas, mapRegistry) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.registry = mapRegistry;
        this.gridSize = 40;

        this.symmetryMode = 'NONE';
        this.planets = [];
        this.draggedPlanet = null;

        this.templates = [
            { x: canvas.width - 150, y: 40, level: 1, radius: 24, label: "Lvl 1" },
            { x: canvas.width - 100, y: 40, level: 2, radius: 32, label: "Lvl 2" },
            { x: canvas.width - 40,  y: 40, level: 3, radius: 40, label: "Lvl 3" }
        ];

        this.setupListeners();
    }

    initNewMap() {
        this.planets = [];
        this.updateSymmetryUI();
    }

    setSymmetry(mode) {
        this.symmetryMode = mode;
        this.updateSymmetryUI();
    }

    updateSymmetryUI() {
        const btnNone = document.getElementById('btn-sym-none');
        const btnMirror = document.getElementById('btn-sym-mirror');
        const btnRot = document.getElementById('btn-sym-rot');
        if (!btnNone) return;

        btnNone.style.background = this.symmetryMode === 'NONE' ? '#2277aa' : '#444';
        btnMirror.style.background = this.symmetryMode === 'MIRROR_H' ? '#2277aa' : '#444';
        btnRot.style.background = this.symmetryMode === 'ROTATIONAL' ? '#2277aa' : '#444';
    }

    snapToGrid(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    getMirroredCoords(x, y) {
        if (this.symmetryMode === 'MIRROR_H') {
            return { x: this.canvas.width - x, y: y };
        } else if (this.symmetryMode === 'ROTATIONAL') {
            return { x: this.canvas.width - x, y: this.canvas.height - y };
        }
        return null;
    }

    setupListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('contextmenu', (e) => this.onRightClick(e));
    }

    onMouseDown(e) {
        if (window.app && window.app.state !== 'EDITOR') return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        for (let t of this.templates) {
            if (Math.hypot(mx - t.x, my - t.y) <= t.radius) {
                const spawnX = this.snapToGrid(this.canvas.width / 2);
                const spawnY = this.snapToGrid(this.canvas.height / 2);
                const newPlanet = { x: spawnX, y: spawnY, level: t.level, owner: 0, id: Date.now() };
                this.planets.push(newPlanet);

                const mirrorPos = this.getMirroredCoords(spawnX, spawnY);
                if (mirrorPos) {
                    this.planets.push({ x: mirrorPos.x, y: mirrorPos.y, level: t.level, owner: 0, twinId: newPlanet.id });
                }

                this.draggedPlanet = newPlanet;
                return;
            }
        }

        for (let p of this.planets) {
            const rad = 20 + p.level * 8;
            if (Math.hypot(mx - p.x, my - p.y) <= rad) {
                if (e.shiftKey) {
                    p.owner = (p.owner + 1) % 3;
                } else {
                    this.draggedPlanet = p;
                }
                return;
            }
        }
    }

    onMouseMove(e) {
        if (window.app && window.app.state !== 'EDITOR' || !this.draggedPlanet) return;
        const rect = this.canvas.getBoundingClientRect();
        const snappedX = this.snapToGrid(e.clientX - rect.left);
        const snappedY = this.snapToGrid(e.clientY - rect.top);

        this.draggedPlanet.x = snappedX;
        this.draggedPlanet.y = snappedY;

        if (this.symmetryMode !== 'NONE') {
            const mirrorPos = this.getMirroredCoords(snappedX, snappedY);
            let twin = this.planets.find(p => p.twinId === this.draggedPlanet.id || p.id === this.draggedPlanet.twinId);
            if (twin) {
                twin.x = mirrorPos.x;
                twin.y = mirrorPos.y;
            }
        }
    }

    onMouseUp() {
        this.draggedPlanet = null;
    }

    onRightClick(e) {
        if (window.app && window.app.state !== 'EDITOR') return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.planets = this.planets.filter(p => {
            const rad = 20 + p.level * 8;
            return Math.hypot(mx - p.x, my - p.y) > rad;
        });
    }

    saveCurrentMap() {
        const slotEl = document.getElementById('editor-save-slot');
        const slotNum = slotEl ? parseInt(slotEl.value, 10) : 1;
        const mapData = {
            width: this.canvas.width,
            height: this.canvas.height,
            planets: this.planets.map(p => ({ x: p.x, y: p.y, level: p.level, owner: p.owner }))
        };
        this.registry.saveSlot(slotNum, mapData);
        alert(`Map saved to Slot ${slotNum}!`);
    }

    render() {
        this.ctx.fillStyle = '#0a0c14';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
        }

        // Symmetry Guide Lines
        if (this.symmetryMode !== 'NONE') {
            this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.25)';
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width / 2, 0);
            this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
            this.ctx.stroke();
            if (this.symmetryMode === 'ROTATIONAL') {
                this.ctx.beginPath();
                this.ctx.moveTo(0, this.canvas.height / 2);
                this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
                this.ctx.stroke();
            }
        }

        // Planets
        const ownerColors = ['#888888', '#00aaff', '#ff4444'];
        for (let p of this.planets) {
            const rad = 20 + p.level * 8;
            this.ctx.fillStyle = ownerColors[p.owner];
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(`L${p.level}`, p.x - 6, p.y + 4);
        }

        // Palette Area
        this.ctx.fillStyle = 'rgba(20, 25, 40, 0.85)';
        this.ctx.fillRect(this.canvas.width - 180, 0, 180, 80);
        this.ctx.strokeStyle = '#334466';
        this.ctx.strokeRect(this.canvas.width - 180, 0, 180, 80);

        for (let t of this.templates) {
            this.ctx.fillStyle = '#556677';
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, t.radius / 1.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(t.label, t.x - 12, t.y + 25);
        }
    }
}