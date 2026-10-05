class App {
    constructor() {
        const dom = (window.GAME_CONFIG && window.GAME_CONFIG.DOM) ? window.GAME_CONFIG.DOM : {};
        this.canvas = document.getElementById(dom.CANVAS_ID || 'game');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        this.state = 'MENU';
        this.selectedSlotNum = 1;
        this.lastTime = performance.now();

        this.registry = typeof MapRegistry === 'function' ? new MapRegistry() : null;

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

    showMainMenu() {
        this.state = 'MENU';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();

        const menuMain = document.getElementById('menu-main');
        const menuMap = document.getElementById('menu-map-select');

        if (menuMain) menuMain.style.display = 'block';
        if (menuMap) menuMap.style.display = 'none';
    }

    showMapSelect() {
        this.state = 'MAP_SELECT';
        if (window.gameManager) window.gameManager.stop();
        this.clearScreen();

        const menuMain = document.getElementById('menu-main');
        const menuMap = document.getElementById('menu-map-select');

        if (menuMain) menuMain.style.display = 'none';
        if (menuMap) menuMap.style.display = 'block';

        this.renderMapSlots();
    }

    renderMapSlots() {
        const container = document.getElementById('slot-buttons');
        if (!container || !this.registry) return;

        container.innerHTML = '';
        const allMaps = this.registry.getAllMaps ? this.registry.getAllMaps() : [];

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
        if (!this.registry) return;

        const width = this.canvas ? this.canvas.width : window.innerWidth;
        const height = this.canvas ? this.canvas.height : window.innerHeight;
        
        const scaledMap = this.registry.getScaledMap(this.selectedSlotNum, width, height);

        this.state = 'GAME';
        this.clearScreen();
        
        const menuMap = document.getElementById('menu-map-select');
        if (menuMap) menuMap.style.display = 'none';

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