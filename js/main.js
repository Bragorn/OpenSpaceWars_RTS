const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let planets = [];
let ships = [];
let controls = null;

function setupCanvas() {
    canvas.width = VIRTUAL_SIZE;
    canvas.height = VIRTUAL_SIZE;
}
setupCanvas();

function initGame() {
    planets = [];
    ships = [];

    const cx = VIRTUAL_SIZE / 2;
    const cy = VIRTUAL_SIZE / 2;

    const layout = LEVEL_SETUP(cx, cy);
    layout.forEach(node => {
        planets.push(new Planet(node.x, node.y, node.level, node.owner));
    });

    controls = new Controls(canvas, 1);
}

function spawnShip(sourcePlanet, targetPlanet) {
    ships.push(new Ship(sourcePlanet, targetPlanet));
}

function destroyShip(ship) {
    ship.dead = true;
}

function dispatchFleet(sourcePlanet, targetPlanet, ratio = 0.5) {
    const availableShips = ships.filter(s => s.targetPlanet === sourcePlanet && s.state === 'orbit' && !s.dead);
    const countToDispatch = Math.ceil(availableShips.length * ratio);
    for (let i = 0; i < countToDispatch; i++) {
        availableShips[i].targetPlanet = targetPlanet;
        availableShips[i].state = 'moving';
    }
}

function handlePlanetImpact(ship) {
    const planet = ship.targetPlanet;

    if (planet.owner === ship.owner) {
        ship.state = planet.isLanding ? 'landing' : 'orbit';
        return;
    }

    planet.hp--;
    if (planet.hp <= 0) {
        planet.owner = ship.owner;
        planet.hp = planet.maxHp;
        planet.upgradeProgress = 0;
        planet.isLanding = false;
    }

    destroyShip(ship);
}

// AI Controller
let aiTimer = 0;
function updateAI(dt) {
    aiTimer += dt;
    if (aiTimer < 3.0) return;
    
    aiTimer = 0;
    const redPlanets = planets.filter(p => p.owner === 2);
    
    redPlanets.forEach(source => {
        if (source.level < 3) {
            const reqCost = TIER_STATS[source.level].upgradeCost;
            if (source.orbitingShipsCount + source.upgradeProgress >= reqCost) {
                source.startLanding();
                return;
            }
        }

        if (source.orbitingShipsCount >= 6 && !source.isLanding) {
            const targets = planets.filter(p => p.owner !== 2);
            if (targets.length > 0) {
                let target = targets[0];
                let minDistSq = Infinity;
                targets.forEach(t => {
                    const dx = t.x - source.x;
                    const dy = t.y - source.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        target = t;
                    }
                });

                dispatchFleet(source, target, 0.5);
            }
        }
    });
}

// Game Loop
let lastTime = performance.now();

function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    planets.forEach(planet => planet.update(dt));

    for (let i = ships.length - 1; i >= 0; i--) {
        if (ships[i].dead) {
            ships.splice(i, 1);
        } else {
            ships[i].update(dt);
        }
    }

    updateAI(dt);

    ctx.clearRect(0, 0, VIRTUAL_SIZE, VIRTUAL_SIZE);

    if (controls) controls.draw(ctx);

    planets.forEach(planet => planet.draw());

    [1, 2].forEach(owner => {
        ctx.fillStyle = OWNER_COLORS[owner];
        ctx.beginPath();
        for (let i = 0; i < ships.length; i++) {
            if (ships[i].owner === owner && !ships[i].dead) {
                ships[i].path();
            }
        }
        ctx.fill();
    });

    for (let i = 0; i < ships.length; i++) {
        ships[i].drawThrusters();
    }

    requestAnimationFrame(gameLoop);
}

initGame();
requestAnimationFrame(gameLoop);