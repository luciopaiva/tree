
import Vector from "./vector.js";

const TRUNK_LENGTH = 0.3;
const N_ATTRACTION_POINTS = 100;
const MAX_BRANCH_SIZE_IN_SEGMENTS = 180;
const MEANDER_ANGLE_IN_RADIANS = 10 / 180 * Math.PI;
const MEANDER_CYCLES_PER_SECOND = 2.5;
const MEANDER_CYCLES_PER_SECONDS_IN_RADIANS = Math.PI / 60 * MEANDER_CYCLES_PER_SECOND;
const BRANCH_GROWTH_STEP = 0.004;

class Segment {
    /**
     * A segment of a branch. x,y are its world coordinates and growthFactor will determine segment's final width.
     * Segments closer to the branch tip will have lower growth factors, causing branches to become thinner as they
     * grow longer.
     *
     * @param x
     * @param y
     * @param growthFactor
     */
    constructor (x, y, growthFactor) {
        this.pos = new Vector(x, y);
        this.initialWidth = 0.01;
        this.initialGrowthSpeed = .2 * growthFactor;
        this.width = this.initialWidth;
        this.growthSpeed = this.initialGrowthSpeed;
        this.growthDeceleration = growthFactor;
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
        this.baseSegmentGrowthFactor = 0.7;

        /** @type {Segment[]} */
        this.segments = [new Segment(x, y, this.baseSegmentGrowthFactor)];
        this.maxSizeInSegments = MAX_BRANCH_SIZE_IN_SEGMENTS;

        this.aux = new Vector(0, 1);  // unit vector up
        this.angleTime = 0;
        this.angleSpeed = MEANDER_CYCLES_PER_SECONDS_IN_RADIANS;
        this.maxAngle = MEANDER_ANGLE_IN_RADIANS;
    }
    update() {
        this.segments.forEach(segment => segment.update());

        if (this.segments.length >= this.maxSizeInSegments) {
            return;
        }

        const tip = this.segments[this.segments.length - 1];

        const aux = this.aux.restore();
        // calculate meandering angle
        let angle = Math.sin(this.angleTime) * this.maxAngle;         // fundamental frequency at 100% amplitude
        angle += Math.sin(2 * this.angleTime) * 0.8 * this.maxAngle;  // first octave at 80% amplitude
        this.angleTime += this.angleSpeed;
        aux.rotate(this.baseAngle + angle);
        aux.mul(BRANCH_GROWTH_STEP);
        aux.add(tip.pos);

        this.segments.push(new Segment(aux.x, aux.y, this.baseSegmentGrowthFactor));
        this.baseSegmentGrowthFactor *= .994;
    }
}

export default class Tree {

    constructor () {
        this.trunk = new Branch(0, 0, 1, 0);

        this.attractionPoints = Array.from(Array(N_ATTRACTION_POINTS),
            () => new Vector(
                2 * Math.random() - 1,
                TRUNK_LENGTH + Math.random() * (1 - TRUNK_LENGTH)
            ));
    }

    update() {
        this.trunk.update();
    }
}
