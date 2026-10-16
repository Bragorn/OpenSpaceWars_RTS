// Pure orbital math, no game state. Used by Ship.js to plan departure burns.
class OrbitalMath {
    static _departCache = new Map();

    // One departure from a circular orbit (planet at origin, start at (r0, 0)):
    // prograde burn until speed reaches vStop, then gravity-only until leaving the SOI.
    static simulateDeparture(r0, s, mu, R, power, vStop, dt) {
        const vCirc = Math.sqrt(mu / r0);
        let x = r0, y = 0, vx = 0, vy = s * vCirc;
        let burning = true, burnTicks = 0, rb = r0;

        for (let i = 0; i < 6000; i++) {
            const sp = Math.sqrt(vx * vx + vy * vy);
            if (burning && sp >= vStop) {
                burning = false;
                burnTicks = i;
                rb = Math.sqrt(x * x + y * y);
            }
            const r2 = Math.max(x * x + y * y, 1);
            const r = Math.sqrt(r2);
            if (!burning && r >= R) {
                return {
                    speed: sp, dirX: vx / sp, dirY: vy / sp,
                    h: Math.abs(x * vy - y * vx) / sp,   // distance of the exit line from the planet
                    burnTicks, rb
                };
            }
            let ax = 0, ay = 0;
            if (r < R) {
                const g = mu / r2;
                ax = -(x / r) * g;
                ay = -(y / r) * g;
            }
            if (burning) {
                ax += (vx / sp) * power;
                ay += (vy / sp) * power;
            }
            vx += ax * dt; vy += ay * dt;
            x += vx * dt; y += vy * dt;
        }
        return null;
    }

    // Finds the burn size that leaves the SOI at exactly cruise speed. Cached.
    static departureTemplate(r0, s, mu, R, power, cruise, dt) {
        const key = `${r0}|${s}|${mu}|${R}|${power}|${cruise}|${dt}`;
        if (OrbitalMath._departCache.has(key)) return OrbitalMath._departCache.get(key);

        const vCirc = Math.sqrt(mu / r0);
        let lo = vCirc + 0.01, hi = vCirc + 250, best = null;
        for (let i = 0; i < 22; i++) {
            const mid = 0.5 * (lo + hi);
            const res = OrbitalMath.simulateDeparture(r0, s, mu, R, power, mid, dt);
            if (!res || res.speed < cruise) {
                lo = mid;
            } else {
                hi = mid;
                best = res;
                best.vStop = mid;
            }
        }
        if (!best) {
            best = OrbitalMath.simulateDeparture(r0, s, mu, R, power, hi, dt);
            if (best) best.vStop = hi;
        }
        OrbitalMath._departCache.set(key, best);
        return best;
    }
}