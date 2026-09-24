const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvas-wrapper');
const gameContainer = document.getElementById('game-container');
const uiOverlay = document.getElementById('ui-overlay');

const hudTime = document.getElementById('hud-time');
const hudBlueStars = document.getElementById('hud-blue-stars');
const hudRedStars = document.getElementById('hud-red-stars');

const debugFps = document.getElementById('debug-fps');
const debugCpu = document.getElementById('debug-cpu');
const debugUnits = document.getElementById('debug-units');

let frameCount = 0;
let lastFpsUpdate = performance.now();

let arenaSize = 600;
let stars = [];
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
    stars = [];
    units = [];
    gameOver = false;
    matchTime = 0;
    uiOverlay.style.display = 'none';

    const cx = arenaSize / 2;
    const cy = arenaSize / 2;
    const ringRadius = arenaSize * 0.36;

    const layoutData = LEVELS[index].setup(cx, cy, ringRadius);
    layoutData.forEach(node => {
        stars.push(new Star(node.x, node.y, node.level, node.owner));
    });
}

function spawnUnit(sourceStar, targetStar) {
    units.push(new Unit(sourceStar, targetStar));
}

function destroyUnit(unit) {
    unit.dead = true;
}

function handleStarImpact(unit) {
    const star = unit.targetStar;

    if (star.owner === unit.owner) {
        unit.state = star.isAbsorbing ? 'sucking' : 'orbit';
        return;
    } 

    star.hp--;
    if (star.hp <= 0) {
        star.owner = unit.owner;
        star.hp = star.maxHp;
        star.upgradeProgress = 0;
        star.isAbsorbing = false;
        checkWinCondition();
    }

    destroyUnit(unit);
}

function checkWinCondition() {
    const blueStars = stars.filter(s => s.owner === 1).length;
    const redStars = stars.filter(s => s.owner === 2).length;

    if (redStars === 0 && units.filter(u => u.owner === 2 && !u.dead).length === 0) {
        gameOver = true;
        uiOverlay.style.display = 'block';
        uiOverlay.style.color = OWNER_COLORS[1];
        uiOverlay.innerText = 'VICTORY!';
    } else if (blueStars === 0 && units.filter(u => u.owner === 1 && !u.dead).length === 0) {
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
        const redStars = stars.filter(s => s.owner === 2);
        redStars.forEach(source => {
            if (source.level < 3) {
                const reqCost = TIER_STATS[source.level].upgradeCost;
                if (source.orbitingUnitsCount + source.upgradeProgress >= reqCost) {
                    source.startUpgradeSuction();
                    return;
                }
            }

            if (source.orbitingUnitsCount >= 6 && !source.isAbsorbing) {
                const targets = stars.filter(s => s.owner !== 2);
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

                    const availableUnits = units.filter(u => u.targetStar === source && u.state === 'orbit' && !u.dead);
                    const countToDispatch = Math.floor(availableUnits.length * 0.5);
                    for (let i = 0; i < countToDispatch; i++) {
                        availableUnits[i].targetStar = target;
                        availableUnits[i].state = 'moving';
                    }
                }
            }
        });
    }
}

// Controls
let dragStartStar = null;
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

function getStarAtPos(pos) {
    for (let star of stars) {
        const dx = star.x - pos.x;
        const dy = star.y - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= star.radius + 12) {
            return star;
        }
    }
    return null;
}

canvas.addEventListener('mousedown', (e) => {
    if (gameOver) return;
    const pos = getCanvasPos(e);
    currentMousePos = pos;
    const star = getStarAtPos(pos);
    if (star && star.owner === 1) {
        dragStartStar = star;
        isDragging = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    currentMousePos = getCanvasPos(e);
});

window.addEventListener('mouseup', (e) => {
    if (isDragging && dragStartStar) {
        const pos = getCanvasPos(e);
        const targetStar = getStarAtPos(pos);
        if (targetStar && targetStar !== dragStartStar) {
            const availableUnits = units.filter(u => u.targetStar === dragStartStar && u.state === 'orbit' && !u.dead);
            const countToDispatch = Math.ceil(availableUnits.length * 0.5);
            for (let i = 0; i < countToDispatch; i++) {
                availableUnits[i].targetStar = targetStar;
                availableUnits[i].state = 'moving';
            }
        }
    }
    isDragging = false;
    dragStartStar = null;
});

canvas.addEventListener('dblclick', (e) => {
    if (gameOver) return;
    const pos = getCanvasPos(e);
    const star = getStarAtPos(pos);
    if (star && star.owner === 1) {
        star.startUpgradeSuction();
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

    const blueCount = stars.filter(s => s.owner === 1).length;
    const redCount = stars.filter(s => s.owner === 2).length;
    hudBlueStars.innerText = blueCount;
    hudRedStars.innerText = redCount;
}

// Main Game Loop
let lastTime = performance.now();

function gameLoop(now) {
    const frameStart = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1) * gameSpeed;
    lastTime = now;

    if (!isPaused) {
        stars.forEach(star => star.update(dt));

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

    if (isDragging && dragStartStar) {
        ctx.beginPath();
        ctx.moveTo(dragStartStar.x, dragStartStar.y);
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    stars.forEach(star => star.draw());

    // Batched Unit Rendering
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