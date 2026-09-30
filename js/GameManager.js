class GameManager {
    constructor() {
        this.planets = [];
        this.ships = [];
    }

    init() {
        this.planets = [];
        this.ships = [];

        const width = window.innerWidth;
        const height = window.innerHeight;

        const layout = LEVEL_SETUP(width, height);
        layout.forEach(node => {
            this.planets.push(new Planet(node.x, node.y, node.level, node.owner));
        });
    }

    spawnShip(sourcePlanet, targetPlanet) {
        this.ships.push(new Ship(sourcePlanet, targetPlanet));
    }

    destroyShip(ship) {
        ship.dead = true;
    }

    dispatchFleet(sourcePlanet, targetPlanet, ratio = 0.5) {
        const availableShips = this.ships.filter(s => s.targetPlanet === sourcePlanet && s.state === 'orbit' && !s.dead);
        const countToDispatch = Math.ceil(availableShips.length * ratio);
        for (let i = 0; i < countToDispatch; i++) {
            availableShips[i].targetPlanet = targetPlanet;
            availableShips[i].state = 'launching';
        }
    }

    handlePlanetImpact(ship) {
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

        this.destroyShip(ship);
    }

    update(dt) {
        this.planets.forEach(planet => planet.update(dt, this));

        for (let i = this.ships.length - 1; i >= 0; i--) {
            if (this.ships[i].dead) {
                this.ships.splice(i, 1);
            } else {
                this.ships[i].update(dt, this);
            }
        }
    }
}