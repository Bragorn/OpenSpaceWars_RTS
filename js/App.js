class App {
    constructor() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.state = 'MENU';
        this.selectedSlotNum = 1;
        this.lastTime = performance.now();

        this.registry = new MapRegistry();

        this.bindEvents();
        this.showMainMenu();
        this.loop(performance.now());
    }

    bindEvents() {
        document.getElementById('btn-main-play')?.addEventListener('click', () => this.showMapSelect());
        document.getElementById('btn-map-back')?.addEventListener('click', () => this.showMainMenu());
        document.getElementById('btn-map-start')?.addEventListener('click', () => this.launchSelectedMap());
    }

    clearScreen() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    setHudVisible(visible) {
        const hud = document.getElementById('hud');
        if (hud) {
            hud.classList.toggle('hidden', !visible);
        }
    }

    showMainMenu() {
        this.state = 'MENU';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();
        this.setHudVisible(false);

        document.getElementById('menu-main').style.display = 'block';
        document.getElementById('menu-map-select').style.display = 'none';
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
        const allMaps = this.registry.getAllMaps();

        allMaps.forEach((map, idx) => {
            const slotNum = idx + 1;
            const btn = document.createElement('button');
            btn.className = `slot-btn ${slotNum === this.selectedSlotNum ? 'selected' : ''}`;
            btn.innerText = `Map ${slotNum}: ${map.name}`;
            btn.onclick = () => {
                this.selectedSlotNum = slotNum;
                this.renderMapSlots();
            };
            container.appendChild(btn);
        });
    }

    launchSelectedMap() {
        const width = this.canvas ? this.canvas.width : window.innerWidth;
        const height = this.canvas ? this.canvas.height : window.innerHeight;
        
        const scaledMap = this.registry.getScaledMap(this.selectedSlotNum, width, height);

        this.state = 'GAME';
        this.clearScreen();
        document.getElementById('menu-map-select').style.display = 'none';

        if (window.gameManager) {
            window.gameManager.start(scaledMap);
        }
    }

    loop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000 || 0;
        this.lastTime = timestamp;

        if (this.state === 'GAME' && window.gameManager) {
            window.gameManager.update(deltaTime);
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