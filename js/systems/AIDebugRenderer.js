class AIDebugRenderer {
    static render(ctx, gameManager) {
        if (!ctx || !gameManager || !gameManager.isRunning) return;

        ctx.save();

        // Essential Power Overlay for AI Controllers
        [gameManager.aiController1, gameManager.aiController2].forEach(ai => {
            if (!ai) return;

            const teamColor = FactionManager.getColor(ai.teamOwner, gameManager);
            const ownedPlanets = gameManager.planets.filter(p => p.owner === ai.teamOwner);

            ownedPlanets.forEach(source => {
                const orbiting = source.getOrbitingShipsCount ? source.getOrbitingShipsCount(gameManager.ships) : 0;
                const myFaction = FactionManager.getFaction(ai.teamOwner, gameManager);
                const myPower = orbiting * (myFaction.hp || 20);

                ctx.fillStyle = teamColor;
                ctx.font = '12px VT323, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`PWR: ${myPower}`, source.x, source.y - (source.radius || 30) - 10);
            });
        });

        ctx.restore();
    }
}

if (typeof window !== 'undefined') {
    window.AIDebugRenderer = AIDebugRenderer;
}