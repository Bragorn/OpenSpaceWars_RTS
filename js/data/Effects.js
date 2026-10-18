// Ship hull: local points (x forward, y sideways), rotated by heading
const HULL_POINTS = [[3.5, 0], [-2.5, -2.0], [-1.0, 0], [-2.5, 2.0]];

const LASER_WIDTH = 1.2;
const LASER_MUZZLE_OFFSET = 3.5;   // px in front of the ship center

const PLUME_OFFSET = 3.0;          // px behind the ship center
const PLUME_MIN_RADIUS = 0.8;
const PLUME_RADIUS_GAIN = 1.0;     // added at full thrust
const PLUME_MIN_THRUST = 0.05;     // below this, no plume is drawn

const THRUSTER_COLOR = '#FF8C1A';  // orange for now

// Explosion timeline: t = 0..1 of its life. Flash, then fire, then dark smoke, then gone.
const EXPLOSION_SCALE = 1.0; // multiplies every radius below
const EXPLOSION_FRAMES = [
    { t: 0.00, r: 2.5, rgb: [255, 255, 255], a: 1.0 },  // white flash starts
    { t: 0.06, r: 5.0, rgb: [255, 255, 255], a: 1.0 },  // peak flash
    { t: 0.25, r: 5.5, rgb: [255, 140, 26],  a: 0.95 }, // orange fire (same as thrusters)
    { t: 0.55, r: 6.0, rgb: [100, 45, 15],   a: 0.7 },  // dark brown
    { t: 1.00, r: 6.5, rgb: [30, 20, 15],    a: 0.0 }   // smoke fades out
];