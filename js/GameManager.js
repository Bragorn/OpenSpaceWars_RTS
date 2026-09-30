class GameManager {
    constructor() {
        this.planets = [];
        this.ships = [];
        this.gameTime = 0;
        this.gameSpeed = 1; // 0 = Pause, 1 = 1x, 2 = 2x, 3 = 3x
        this.gameOver = false;
        this.winner = null; // 1 = Player, 2 = AI
    }

    init() {
        this.planets = [];
        this.ships = [];
        this.gameTime = 0;
        this.gameSpeed = 1;
        this.gameOver = false;
        this.winner = null;

        const width = window.innerWidth;
        const height = window.innerHeight;

        const layout = LEVEL_SETUP(width, height);
        layout.forEach(node => {
            this.planets.push(new Planet(node.x, node.y, node.level, node.owner));
        });
    }

    spawnShip(sourcePlanet, targetPlanet) {
        const ship = new Ship(sourcePlanet, targetPlanet);
        ship.owner = sourcePlanet.owner; // Direct ownership assignment
        this.ships.push(ship);
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

    checkWinCondition() {
        if (this.gameOver) return;

        // Count planets per team
        const p1Planets = this.planets.filter(p => p.owner === 1).length;
        const p2Planets = this.planets.filter(p => p.owner === 2).length;

        // Count active ships per team
        const p1Ships = this.ships.filter(s => s.owner === 1 && !s.dead).length;
        const p2Ships = this.ships.filter(s => s.owner === 2 && !s.dead).length;

        // Player has no planets and no active ships -> AI Wins
        if (p1Planets === 0 && p1Ships === 0) {
            this.gameOver = true;
            this.winner = 2;
        } 
        // AI has no planets and no active ships -> Player Wins
        else if (p2Planets === 0 && p2Ships === 0) {
            this.gameOver = true;
            this.winner = 1;
        }
    }

    update(dt) {
        if (this.gameOver) return;

        const scaledDt = dt * this.gameSpeed;
        if (this.gameSpeed > 0) {
            this.gameTime += scaledDt;
        }

        this.planets.forEach(planet => planet.update(scaledDt, this));

        for (let i = this.ships.length - 1; i >= 0; i--) {
            if (this.ships[i].dead) {
                this.ships.splice(i, 1);
            } else {
                this.ships[i].update(scaledDt, this);
            }
        }

        this.checkWinCondition();
    }
}