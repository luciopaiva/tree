
import Vector from "./vector.js";

/*
   A tree model is always 1 unit high and 2 wide. All constants below take that into account.
   The root is at 0,0.
 */
const CROWN_HEIGHT_IN_UNITS = 0.3;
const TRUNK_WIDTH_IN_UNITS = 0.15;
const N_ATTRACTION_POINTS = 100;
const MIN_BRANCH_WIDTH_RATIO = 0.2;  // min value allowed for `current width / base width` before branch stops growing
const GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE = 0.004;
const BRANCH_LENGTH_GROWTH_STEP_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * 1.4;  // distance between segments
const BRANCH_WIDTH_GROWTH_SPEED_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * .4;
const MEANDER_ANGLE_IN_RADIANS = 15 / 180 * Math.PI;
const MEANDER_CYCLES_PER_SECOND = 2.5;
const MEANDER_CYCLES_PER_SECONDS_IN_RADIANS = Math.PI / 60 * MEANDER_CYCLES_PER_SECOND;
const SEGMENT_INITIAL_WIDTH_IN_UNITS = 0.03;  // width of a segment that has just born
const NEXT_SEGMENT_WIDTH_RATIO = .986;  // width of next segment is this fraction of the current one

class Segment {
    /**
     * A segment of a branch. x,y are its world coordinates and growthFactor will determine segment's final width.
     * Segments closer to the branch tip will have lower growth factors, causing branches to become thinner as they
     * grow longer.
     *
     * @param x
     * @param y
     * @param finalWidth
     */
    constructor (x, y, finalWidth) {
        this.pos = new Vector(x, y);
        this.finalWidth = finalWidth;
        this.initialWidth = SEGMENT_INITIAL_WIDTH_IN_UNITS;
        this.width = this.initialWidth;
    }
    update() {
        if (this.width < this.finalWidth) {
            this.width += BRANCH_WIDTH_GROWTH_SPEED_IN_UNITS_PER_UPDATE;
        }
    }
}

class Branch {
    constructor (x, y, baseAngle, baseWidth) {
        this.baseAngle = Math.PI + baseAngle;
        this.baseWidth = baseWidth;

        /** @type {Segment[]} */
        this.segments = [new Segment(x, y, this.currentWidth)];

        this.minWidth = MIN_BRANCH_WIDTH_RATIO * this.baseWidth;
        this.currentWidth = this.baseWidth;

        this.aux = new Vector(0, 1);  // unit vector up
        this.angleTime = 0;
        this.angleSpeed = MEANDER_CYCLES_PER_SECONDS_IN_RADIANS;
        this.maxAngle = MEANDER_ANGLE_IN_RADIANS;
    }
    update() {
        this.segments.forEach(segment => segment.update());

        if (this.currentWidth < this.minWidth) {
            return;
        }

        const tip = this.segments[this.segments.length - 1];

        const aux = this.aux.restore();
        // calculate meandering angle
        let angle = Math.sin(this.angleTime) * this.maxAngle;         // fundamental frequency at 100% amplitude
        angle += Math.sin(2 * this.angleTime) * 0.8 * this.maxAngle;  // first octave at 80% amplitude
        this.angleTime += this.angleSpeed;
        aux.rotate(this.baseAngle + angle);
        aux.mul(BRANCH_LENGTH_GROWTH_STEP_IN_UNITS_PER_UPDATE);
        aux.add(tip.pos);

        this.segments.push(new Segment(aux.x, aux.y, this.currentWidth));
        this.currentWidth *= NEXT_SEGMENT_WIDTH_RATIO;
    }
}

export default class Tree {

    constructor () {
        /** @type {Branch[]} */
        this.branches = [];
        const trunk = new Branch(0, 0, 0, TRUNK_WIDTH_IN_UNITS);
        this.branches.push(trunk);

        this.attractionPoints = Array.from(Array(N_ATTRACTION_POINTS),
            () => new Vector(
                2 * Math.random() - 1,
                CROWN_HEIGHT_IN_UNITS + Math.random() * (1 - CROWN_HEIGHT_IN_UNITS)
            ));
    }

    update() {
        for (const attractionPoint of this.attractionPoints) {
            for (const branch of this.branches) {
                // todo
            }
        }

        this.branches.forEach(branch => branch.update());
    }
}
