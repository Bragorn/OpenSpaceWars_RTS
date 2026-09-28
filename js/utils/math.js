// Checks if line segment (x1, y1) -> (x2, y2) intersects a planet's collision boundary
function isPathBlockedByPlanet(x1, y1, x2, y2, planet, margin = 4) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;

    let t = ((planet.x - x1) * dx + (planet.y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    const distSq = (planet.x - closestX) ** 2 + (planet.y - closestY) ** 2;
    const safeRadius = planet.radius + margin;

    return distSq < safeRadius * safeRadius;
}