
import Vector from "./vector.js";

const TRUNK_LENGTH = 0.3;
const N_ATTRACTION_POINTS = 1000;

class Segment {
    constructor (x, y) {
        this.pos = new Vector(x, y);
        this.initialWidth = 0.0001;
        this.initialGrowthSpeed = .15;
        this.width = this.initialWidth;
        this.growthSpeed = this.initialGrowthSpeed;
        this.growthDeceleration = .7;
    }
    update() {
        if (this.growthSpeed > 0) {
            this.width += this.growthSpeed;
            this.growthSpeed *= this.growthDeceleration;
        }
    }
}

class Branch {
    constructor (x, y, scale, baseAngle) {
        this.scale = scale;
        this.baseAngle = Math.PI + baseAngle;

        /** @type {Segment[]} */
        this.segments = [new Segment(x, y)];

        this.aux = new Vector(0, 1);  // unit vector up
        this.angleTime = 0;
        this.angleSpeed = Math.PI / 60;  // 3 degrees per second
        this.maxAngle = 30 / 180 * Math.PI;
    }
    update(growthStep) {
        this.segments.forEach(segment => segment.update());

        const tip = this.segments[this.segments.length - 1];

        const aux = this.aux.restore();
        const angle = Math.cos(this.angleTime) * this.maxAngle;
        this.angleTime += this.angleSpeed;
        aux.rotate(this.baseAngle + angle);
        aux.mul(growthStep);
        aux.add(tip.pos);

        this.segments.push(new Segment(aux.x, aux.y, 1));
    }
}

export default class Tree {

    constructor () {
        this.growthStep = 0.004;
        this.trunk = new Branch(0, 0, 1, 0);

        this.attractionPoints = Array.from(Array(N_ATTRACTION_POINTS),
            () => new Vector(
                2 * Math.random() - 1,
                TRUNK_LENGTH + Math.random() * (1 - TRUNK_LENGTH)
            ));
    }

    update() {
        this.trunk.update(this.growthStep);
    }
}
