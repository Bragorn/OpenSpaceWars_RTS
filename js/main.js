const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const arenaSize = VIRTUAL_SIZE;
let planets = [];
let ships = [];

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

    // 8-Planet Layout: 2 Bases (Player & Enemy) + 3 Neutral per side
    const layout = [
        // Left Side (Player Territory)
        { x: cx - 260, y: cy, level: 1, owner: 1 },        // Player Base
        { x: cx - 180, y: cy - 160, level: 1, owner: 0 },  // Left Top Neutral
        { x: cx - 110, y: cy, level: 1, owner: 0 },        // Left Inner Neutral
        { x: cx - 180, y: cy + 160, level: 1, owner: 0 },  // Left Bottom Neutral

        // Right Side (Enemy Territory)
        { x: cx + 260, y: cy, level: 1, owner: 2 },        // Enemy Base
        { x: cx + 180, y: cy - 160, level: 1, owner: 0 },  // Right Top Neutral
        { x: cx + 110, y: cy, level: 1, owner: 0 },        // Right Inner Neutral
        { x: cx + 180, y: cy + 160, level: 1, owner: 0 }   // Right Bottom Neutral
    ];

    layout.forEach(node => {
        planets.push(new Planet(node.x, node.y, node.level, node.owner));
    });
}

function spawnShip(sourcePlanet, targetPlanet) {
    ships.push(new Ship(sourcePlanet, targetPlanet));
}

function destroyShip(ship) {
    ship.dead = true;
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

    if (aiTimer >= 3.0) {
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

                    const availableShips = ships.filter(s => s.targetPlanet === source && s.state === 'orbit' && !s.dead);
                    const countToDispatch = Math.floor(availableShips.length * 0.5);
                    for (let i = 0; i < countToDispatch; i++) {
                        availableShips[i].targetPlanet = target;
                        availableShips[i].state = 'moving';
                    }
                }
            }
        });
    }
}

// Mouse Controls
let dragStartPlanet = null;
let isDragging = false;
let currentMousePos = { x: 0, y: 0 };

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
        x: (clientX - rect.left) * (VIRTUAL_SIZE / rect.width),
        y: (clientY - rect.top) * (VIRTUAL_SIZE / rect.height)
    };
}

function getPlanetAtPos(pos) {
    for (let planet of planets) {
        const dx = planet.x - pos.x;
        const dy = planet.y - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= planet.radius + 14) {
            return planet;
        }
    }
    return null;
}

canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasPos(e);
    currentMousePos = pos;
    const planet = getPlanetAtPos(pos);
    if (planet && planet.owner === 1) {
        dragStartPlanet = planet;
        isDragging = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    currentMousePos = getCanvasPos(e);
});

window.addEventListener('mouseup', () => {
    if (isDragging && dragStartPlanet) {
        const targetPlanet = getPlanetAtPos(currentMousePos);
        if (targetPlanet && targetPlanet !== dragStartPlanet) {
            const availableShips = ships.filter(s => s.targetPlanet === dragStartPlanet && s.state === 'orbit' && !s.dead);
            const countToDispatch = Math.ceil(availableShips.length * 0.5);
            for (let i = 0; i < countToDispatch; i++) {
                availableShips[i].targetPlanet = targetPlanet;
                availableShips[i].state = 'moving';
            }
        }
    }
    isDragging = false;
    dragStartPlanet = null;
});

canvas.addEventListener('dblclick', (e) => {
    const pos = getCanvasPos(e);
    const planet = getPlanetAtPos(pos);
    if (planet && planet.owner === 1) {
        planet.startLanding();
    }
});

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

    if (isDragging && dragStartPlanet) {
        ctx.beginPath();
        ctx.moveTo(dragStartPlanet.x, dragStartPlanet.y);
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
        ctx.strokeStyle = OWNER_COLORS[1];
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

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