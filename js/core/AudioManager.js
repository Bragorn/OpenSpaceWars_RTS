// Usage: AudioManager.play('laser')
// Uses plain HTML audio so it works even when index.html is opened from disk (file://).
const AudioManager = {
    templates: new Map(),
    lastPlayed: new Map(),
    voices: new Map(),
    volumes: { master: 0.8, sfx: 1.0, ui: 1.0, music: 0.6 },
    ready: false,

    init() {
        if (this.ready) return;
        for (const id of Object.keys(SOUND_DATA)) {
            if (!SOUND_DATA[id].file) continue;
            const a = new Audio(SOUND_DATA[id].file);
            a.preload = 'auto';
            a.addEventListener('error', () => {
                console.warn(`AudioManager: could not load "${id}" (${SOUND_DATA[id].file})`);
            });
            this.templates.set(id, a);
        }
        this.ready = true;
    },

    play(id, opts = {}) {
        if (!this.ready) return;
        const def = SOUND_DATA[id];
        const tpl = this.templates.get(id);
        if (!def || !tpl || tpl.error) return;

        // Anti-spam: per-sound cooldown and voice cap
        const now = performance.now() / 1000;
        if (now - (this.lastPlayed.get(id) || -Infinity) < def.cooldown) return;
        const active = this.voices.get(id) || 0;
        if (active >= def.maxVoices) return;
        this.lastPlayed.set(id, now);
        this.voices.set(id, active + 1);

        const a = tpl.cloneNode();
        const busVol = this.volumes[def.bus] !== undefined ? this.volumes[def.bus] : 1;
        const vol = def.volume * (opts.volume !== undefined ? opts.volume : 1) * busVol * this.volumes.master;
        a.volume = Math.max(0, Math.min(1, vol));
        a.preservesPitch = false;
        a.playbackRate = 1 + (Math.random() * 2 - 1) * (def.pitchVar || 0);

        let done = false;
        const release = () => {
            if (done) return;
            done = true;
            this.voices.set(id, Math.max(0, (this.voices.get(id) || 1) - 1));
        };
        a.addEventListener('ended', release, { once: true });
        a.addEventListener('error', release, { once: true });
        const p = a.play();
        if (p && p.catch) p.catch(release); // e.g. blocked before the first click
    },

    setVolume(bus, value) {
        this.volumes[bus] = Math.max(0, Math.min(1, value));
    }
};