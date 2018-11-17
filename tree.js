
import Vector from "./vector.js";

const TRUNK_LENGTH = 0.3;
const N_ATTRACTION_POINTS = 1000;

export default class Tree {

    constructor () {
        this.root = new Vector();
        this.trunk = [new Vector()];
        this.attractionPoints = Array.from(Array(N_ATTRACTION_POINTS),
            () => new Vector(
                2 * Math.random() - 1,
                TRUNK_LENGTH + Math.random() * (1 - TRUNK_LENGTH)
            ));
        this.growthStep = 0.01;
    }

    update() {
        const tip = this.trunk[this.trunk.length - 1];
        this.trunk.push(new Vector(tip.x, tip.y + this.growthStep));
    }
}
