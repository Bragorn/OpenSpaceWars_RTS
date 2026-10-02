class MapRegistry {
    static STORAGE_KEY_PREFIX = 'osw_map_slot_';

    getDefaultMap() {
        const w = window.innerWidth || 1200;
        const h = window.innerHeight || 800;

        return {
            name: "Default Battleground",
            width: w,
            height: h,
            // Reads directly from LEVEL_SETUP in config.js
            planets: typeof LEVEL_SETUP === 'function' ? LEVEL_SETUP(w, h) : []
        };
    }

    loadSlot(slotNum) {
        const saved = localStorage.getItem(`${MapRegistry.STORAGE_KEY_PREFIX}${slotNum}`);
        return saved ? JSON.parse(saved) : null;
    }

    saveSlot(slotNum, mapData) {
        mapData.name = mapData.name || `Custom Map Slot ${slotNum}`;
        localStorage.setItem(`${MapRegistry.STORAGE_KEY_PREFIX}${slotNum}`, JSON.stringify(mapData));
    }

    getMap(slotNum) {
        // 1. Check if user saved a custom map in this slot
        const savedMap = this.loadSlot(slotNum);
        if (savedMap) return savedMap;

        // 2. Slot 1 defaults to config.js LEVEL_SETUP
        if (slotNum === 1 || slotNum === '1') {
            return this.getDefaultMap();
        }

        // 3. Slots 2-5 are strictly empty until created in Map Editor
        return null;
    }
}