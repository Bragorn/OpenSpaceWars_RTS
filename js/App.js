class App {
    constructor() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.state = 'MENU';
        this.selectedSlotNum = 1;
        this.lastTime = performance.now();

        this.registry = new MapRegistry();
        this.editor = new MapEditor(this.canvas, this.registry);

        this.bindEvents();
        this.showMainMenu();
        this.loop(performance.now());
    }

    bindEvents() {
        document.getElementById('btn-main-play')?.addEventListener('click', () => this.showMapSelect());
        document.getElementById('btn-main-editor')?.addEventListener('click', () => this.startMapEditor());

        document.getElementById('btn-map-back')?.addEventListener('click', () => this.showMainMenu());
        document.getElementById('btn-map-start')?.addEventListener('click', () => this.launchSelectedMap());

        document.getElementById('btn-editor-exit')?.addEventListener('click', () => this.showMainMenu());
        document.getElementById('btn-editor-save')?.addEventListener('click', () => this.editor.saveCurrentMap());
        document.getElementById('btn-sym-none')?.addEventListener('click', () => this.editor.setSymmetry('NONE'));
        document.getElementById('btn-sym-mirror')?.addEventListener('click', () => this.editor.setSymmetry('MIRROR_H'));
        document.getElementById('btn-sym-rot')?.addEventListener('click', () => this.editor.setSymmetry('ROTATIONAL'));
    }

    clearScreen() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    setHudVisible(visible) {
        const hud = document.getElementById('hud');
        if (hud) {
            if (visible) {
                hud.classList.remove('hidden');
            } else {
                hud.classList.add('hidden');
            }
        }
    }

    showMainMenu() {
        this.state = 'MENU';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();
        this.setHudVisible(false);

        document.getElementById('menu-main').style.display = 'block';
        document.getElementById('menu-map-select').style.display = 'none';
        document.getElementById('editor-toolbar').style.display = 'none';
    }

    showMapSelect() {
        this.state = 'MAP_SELECT';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();
        this.setHudVisible(false);

        document.getElementById('menu-main').style.display = 'none';
        document.getElementById('menu-map-select').style.display = 'block';

        this.renderMapSlots();
    }

    renderMapSlots() {
        const container = document.getElementById('slot-buttons');
        if (!container) return;

        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const map = this.registry.getMap(i);
            const btn = document.createElement('button');
            btn.className = `slot-btn ${i === this.selectedSlotNum ? 'selected' : ''}`;
            btn.innerText = `Slot ${i}: ${map ? map.name : '[ Empty ]'}`;
            btn.onclick = () => {
                this.selectedSlotNum = i;
                this.renderMapSlots();
            };
            container.appendChild(btn);
        }
    }

    startMapEditor() {
        this.state = 'EDITOR';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();
        this.setHudVisible(false);

        document.getElementById('menu-main').style.display = 'none';
        document.getElementById('menu-map-select').style.display = 'none';
        document.getElementById('editor-toolbar').style.display = 'block';

        this.editor.initNewMap();
    }

    launchSelectedMap() {
        const selectedMap = this.registry.getMap(this.selectedSlotNum);
        if (!selectedMap) {
            alert("This slot is empty! Design a map in the editor first.");
            return;
        }

        this.state = 'GAME';
        this.clearScreen();
        document.getElementById('menu-map-select').style.display = 'none';

        if (window.gameManager) {
            window.gameManager.start(selectedMap);
        }
    }

    loop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000 || 0;
        this.lastTime = timestamp;

        if (this.state === 'GAME' && window.gameManager) {
            window.gameManager.update(deltaTime);
        } else if (this.state === 'EDITOR') {
            this.editor.render();
        } else if (this.state === 'MENU' || this.state === 'MAP_SELECT') {
            this.clearScreen();
        }

        requestAnimationFrame((ts) => this.loop(ts));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
} else {
    window.app = new App();
}