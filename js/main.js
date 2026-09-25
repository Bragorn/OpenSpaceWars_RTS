const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvas-wrapper');
const gameContainer = document.getElementById('game-container');
const uiOverlay = document.getElementById('ui-overlay');

const hudTime = document.getElementById('hud-time');
const hudBluePlanets = document.getElementById('hud-blue-planets') || document.getElementById('hud-blue-stars');
const hudRedPlanets = document.getElementById('hud-red-planets') || document.getElementById('hud-red-stars');

const debugFps = document.getElementById('debug-fps');
const debugCpu = document.getElementById('debug-cpu');
const debugUnits = document.getElementById('debug-units');

let frameCount = 0;
let lastFpsUpdate = performance.now();

let arenaSize = 600;
let planets = [];
let units = [];

let gameOver = false;
let isPaused = false;
let gameSpeed = 1;
let matchTime = 0;
let currentLevelIndex = 0;

function resizeGameArea() {
    const containerWidth = gameContainer.clientWidth - 32;
    const containerHeight = gameContainer.clientHeight - 32;
    arenaSize = Math.max(300, Math.min(containerWidth, containerHeight));

    canvasWrapper.style.width = arenaSize + 'px';
    canvasWrapper.style.height = arenaSize + 'px';
    canvas.width = arenaSize;
    canvas.height = arenaSize;
}
window.addEventListener('resize', resizeGameArea);
resizeGameArea();

function loadLevel(index) {
    planets = [];
    units = [];
    gameOver = false;
    matchTime = 0;
    uiOverlay.style.display = 'none';

    const cx = arenaSize / 2;
    const cy = arenaSize / 2;
    const ringRadius = arenaSize * 0.36;

    const layoutData = LEVELS[index].setup(cx, cy, ringRadius);
    layoutData.forEach(node => {
        planets.push(new Planet(node.x, node.y, node.level, node.owner));
    });
}

function spawnUnit(sourcePlanet, targetPlanet) {
    units.push(new Unit(sourcePlanet, targetPlanet));
}

function destroyUnit(unit) {
    unit.dead = true;
}

function handlePlanetImpact(unit) {
    const planet = unit.targetPlanet;

    if (planet.owner === unit.owner) {
        unit.state = planet.isDocking ? 'docking' : 'orbit';
        return;
    } 

    planet.hp--;
    if (planet.hp <= 0) {
        planet.owner = unit.owner;
        planet.hp = planet.maxHp;
        planet.upgradeProgress = 0;
        planet.isDocking = false;
        checkWinCondition();
    }

    destroyUnit(unit);
}

function checkWinCondition() {
    const bluePlanets = planets.filter(p => p.owner === 1).length;
    const redPlanets = planets.filter(p => p.owner === 2).length;

    if (redPlanets === 0 && units.filter(u => u.owner === 2 && !u.dead).length === 0) {
        gameOver = true;
        uiOverlay.style.display = 'block';
        uiOverlay.style.color = OWNER_COLORS[1];
        uiOverlay.innerText = 'VICTORY!';
    } else if (bluePlanets === 0 && units.filter(u => u.owner === 1 && !u.dead).length === 0) {
        gameOver = true;
        uiOverlay.style.display = 'block';
        uiOverlay.style.color = OWNER_COLORS[2];
        uiOverlay.innerText = 'DEFEAT!';
    }
}

let aiTimer = 0;
function updateAI(dt) {
    if (gameOver) return;
    aiTimer += dt;

    if (aiTimer >= 3.5) {
        aiTimer = 0;
        const redPlanets = planets.filter(p => p.owner === 2);
        redPlanets.forEach(source => {
            if (source.level < 3) {
                const reqCost = TIER_STATS[source.level].upgradeCost;
                if (source.orbitingUnitsCount + source.upgradeProgress >= reqCost) {
                    source.startDocking();
                    return;
                }
            }

            if (source.orbitingUnitsCount >= 6 && !source.isDocking) {
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

                    const availableUnits = units.filter(u => u.targetPlanet === source && u.state === 'orbit' && !u.dead);
                    const countToDispatch = Math.floor(availableUnits.length * 0.5);
                    for (let i = 0; i < countToDispatch; i++) {
                        availableUnits[i].targetPlanet = target;
                        availableUnits[i].state = 'moving';
                    }
                }
            }
        });
    }
}

// Controls
let dragStartPlanet = null;
let isDragging = false;
let currentMousePos = { x: 0, y: 0 };

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function getPlanetAtPos(pos) {
    for (let planet of planets) {
        const dx = planet.x - pos.x;
        const dy = planet.y - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= planet.radius + 12) {
            return planet;
        }
    }
    return null;
}

canvas.addEventListener('mousedown', (e) => {
    if (gameOver) return;
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

window.addEventListener('mouseup', (e) => {
    if (isDragging && dragStartPlanet) {
        const pos = getCanvasPos(e);
        const targetPlanet = getPlanetAtPos(pos);
        if (targetPlanet && targetPlanet !== dragStartPlanet) {
            const availableUnits = units.filter(u => u.targetPlanet === dragStartPlanet && u.state === 'orbit' && !u.dead);
            const countToDispatch = Math.ceil(availableUnits.length * 0.5);
            for (let i = 0; i < countToDispatch; i++) {
                availableUnits[i].targetPlanet = targetPlanet;
                availableUnits[i].state = 'moving';
            }
        }
    }
    isDragging = false;
    dragStartPlanet = null;
});

canvas.addEventListener('dblclick', (e) => {
    if (gameOver) return;
    const pos = getCanvasPos(e);
    const planet = getPlanetAtPos(pos);
    if (planet && planet.owner === 1) {
        planet.startDocking();
    }
});

// UI Event Listeners
const btnPause = document.getElementById('btn-pause');
btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    btnPause.innerText = isPaused ? 'Resume' : 'Pause';
    btnPause.classList.toggle('active', isPaused);
});

const btnReset = document.getElementById('btn-reset');
btnReset.addEventListener('click', () => {
    loadLevel(currentLevelIndex);
});

const speedBtns = document.querySelectorAll('.speed-btn');
speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gameSpeed = parseFloat(btn.dataset.speed);
    });
});

const levelSelect = document.getElementById('level-select');
levelSelect.addEventListener('change', (e) => {
    currentLevelIndex = parseInt(e.target.value, 10);
    loadLevel(currentLevelIndex);
});

function updateHUD(dt) {
    if (!gameOver && !isPaused) {
        matchTime += dt;
    }
    const mins = Math.floor(matchTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(matchTime % 60).toString().padStart(2, '0');
    hudTime.innerText = `${mins}:${secs}`;

    const blueCount = planets.filter(p => p.owner === 1).length;
    const redCount = planets.filter(p => p.owner === 2).length;
    if (hudBluePlanets) hudBluePlanets.innerText = blueCount;
    if (hudRedPlanets) hudRedPlanets.innerText = redCount;
}

// Main Game Loop
let lastTime = performance.now();

function gameLoop(now) {
    const frameStart = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1) * gameSpeed;
    lastTime = now;

    if (!isPaused) {
        planets.forEach(planet => planet.update(dt));

        for (let i = units.length - 1; i >= 0; i--) {
            if (units[i].dead) {
                units.splice(i, 1);
            } else {
                units[i].update(dt);
            }
        }

        updateAI(dt);
        updateHUD(dt);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Central Sun
    const cx = arenaSize / 2;
    const cy = arenaSize / 2;
    const sunRadius = typeof SUN_CONFIG !== 'undefined' ? SUN_CONFIG.radius : 32;
    const sunColor = typeof SUN_CONFIG !== 'undefined' ? SUN_CONFIG.color : '#ffaa00';

    ctx.beginPath();
    ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunColor;
    ctx.fill();

    // 2. Draw Target Drag Line
    if (isDragging && dragStartPlanet) {
        ctx.beginPath();
        ctx.moveTo(dragStartPlanet.x, dragStartPlanet.y);
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 3. Draw Planets
    planets.forEach(planet => planet.draw());

    // 4. Batched Unit Rendering
    [1, 2].forEach(owner => {
        ctx.fillStyle = OWNER_COLORS[owner];
        ctx.beginPath();
        for (let i = 0; i < units.length; i++) {
            if (units[i].owner === owner && !units[i].dead) {
                units[i].path();
            }
        }
        ctx.fill();
    });

    // --- PERFORMANCE TRACKER ---
    frameCount++;
    const frameComputeTime = performance.now() - frameStart;

    if (now - lastFpsUpdate >= 250) { // Refresh stats 4x per second
        const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;

        if (debugFps) debugFps.innerText = fps;
        if (debugCpu) {
            debugCpu.innerText = `${frameComputeTime.toFixed(1)}ms`;
            // Color code red if CPU compute time exceeds 16.6ms (60 FPS threshold)
            debugCpu.style.color = frameComputeTime > 16.6 ? '#ff3366' : '#00ffaa';
        }
        if (debugUnits) debugUnits.innerText = units.length;
    }

    requestAnimationFrame(gameLoop);
}

loadLevel(0);
requestAnimationFrame(gameLoop);