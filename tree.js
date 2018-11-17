
import Vector from "./vector.js";

/*
   A tree model is always 1 unit high and 2 wide. All constants below take that into account.
   The root is at 0,0.
 */
const CROWN_HEIGHT_IN_UNITS = 0.3;
const TRUNK_WIDTH_IN_UNITS = 0.15;
const N_ATTRACTION_POINTS = 200;
const MIN_BRANCH_WIDTH_RATIO = 0.2;  // min value allowed for `current width / base width` before branch stops growing
const GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE = 0.004;
const BRANCH_LENGTH_GROWTH_STEP_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * 1.4;  // distance between segments
const BRANCH_WIDTH_GROWTH_SPEED_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * .4;
const MEANDER_ANGLE_IN_RADIANS = 15 / 180 * Math.PI;
const MEANDER_CYCLES_PER_SECOND = 2.5;
const MEANDER_CYCLES_PER_SECONDS_IN_RADIANS = Math.PI / 60 * MEANDER_CYCLES_PER_SECOND;
const SEGMENT_INITIAL_WIDTH_IN_UNITS = 0.03;  // width of a segment that has just born
const NEXT_SEGMENT_WIDTH_RATIO = .986;  // width of next segment is this fraction of the current one
const COLONIZATION_INFLUENCE_RADIUS = 0.3;
const COLONIZATION_KILL_RADIUS = 0.1;
const SEGMENT_SEARCH_STEP = 10;  // this will increase gap between branch spawns

let nextBranchId = 1;

class Segment {
    /**
     * A segment of a branch. x,y are its world coordinates and growthFactor will determine segment's final width.
     * Segments closer to the branch tip will have lower growth factors, causing branches to become thinner as they
     * grow longer.
     *
     * @param branch
     * @param x
     * @param y
     * @param angle
     * @param finalWidth
     */
    constructor (branch, x, y, angle, finalWidth) {
        this.branch = branch;
        this.pos = new Vector(x, y);
        this.angle = angle;
        this.finalWidth = finalWidth;
        this.initialWidth = SEGMENT_INITIAL_WIDTH_IN_UNITS;
        this.width = this.initialWidth;
        this.attractionPoints = [];
        this.isTipOfBranch = true;
    }
    update() {
        if (this.width < this.finalWidth) {
            this.width += BRANCH_WIDTH_GROWTH_SPEED_IN_UNITS_PER_UPDATE;
        }
    }
    clearAttractionPoints() {
        this.attractionPoints.length = 0;
    }
    addAttractionPoint(point) {
        this.attractionPoints.push(point);
    }
}

class Branch {
    constructor (x, y, baseAngle, baseWidth) {
        this.id = nextBranchId++;

        this.baseAngle = Math.PI + baseAngle;
        this.baseWidth = baseWidth;

        /** @type {Segment[]} */
        this.segments = [new Segment(this, x, y, this.currentWidth)];

        this.minWidth = MIN_BRANCH_WIDTH_RATIO * this.baseWidth;
        this.currentWidth = this.baseWidth;

        this.aux = new Vector(0, 1);  // unit vector up
        this.angleTime = 0;
        this.angleSpeed = MEANDER_CYCLES_PER_SECONDS_IN_RADIANS;
        this.maxAngle = MEANDER_ANGLE_IN_RADIANS;
    }

    getTip() {
        return this.segments[this.segments.length - 1];
    }

    grow(angle) {
        const tip = this.segments[this.segments.length - 1];

        if (!angle) {
            // no specific angle was provided - calculate meandering angle
            angle = Math.sin(this.angleTime) * this.maxAngle;         // fundamental frequency at 100% amplitude
            angle += Math.sin(2 * this.angleTime) * 0.8 * this.maxAngle;  // first octave at 80% amplitude
        }

        const segmentAngle = this.baseAngle + angle;

        const aux = this.aux.restore();
        aux.rotate(segmentAngle);
        aux.mul(BRANCH_LENGTH_GROWTH_STEP_IN_UNITS_PER_UPDATE);
        aux.add(tip.pos);

        this.segments.push(new Segment(this, aux.x, aux.y, segmentAngle, this.currentWidth));

        tip.isTipOfBranch = false;  // no longer the tip

        // update step variables
        this.angleTime += this.angleSpeed;
        this.currentWidth *= NEXT_SEGMENT_WIDTH_RATIO;
    }

    update() {
        this.segments.forEach(segment => segment.update());

        if (this.currentWidth < this.minWidth) {
            return;
        }

        this.grow();
    }
}

export default class Tree {

    constructor () {
        /** @type {Branch[]} */
        this.branches = [];
        const trunk = new Branch(0, 0, 0, TRUNK_WIDTH_IN_UNITS);
        this.branches.push(trunk);

        this.accVector = new Vector();
        this.auxVector = new Vector();

        this.attractionPoints = Array.from(Array(N_ATTRACTION_POINTS),
            () => new Vector(
                2 * Math.random() - 1,
                CROWN_HEIGHT_IN_UNITS + Math.random() * (1 - CROWN_HEIGHT_IN_UNITS)
            ));
    }

    obtainAttractedSegments() {
        /** @type {Segment[]} */
        let selectedSegments = [];

        for (let pi = 0; pi < this.attractionPoints.length; pi++) {
            const attractionPoint = this.attractionPoints[pi];

            // ToDo if point is not at COLONIZATION_INFLUENCE_RADIUS from tree's bounding box, skip

            /** @type {Segment} */
            let nearestSegment = null;
            let shortestDistance = Number.POSITIVE_INFINITY;

            for (const branch of this.branches) {
                for (let si = branch.segments.length - 1; si > 0; si -= SEGMENT_SEARCH_STEP) {
                    const segment = branch.segments[si];
                    const distance = Vector.distance(attractionPoint, segment.pos);
                    if (distance < COLONIZATION_INFLUENCE_RADIUS && distance < shortestDistance) {
                        shortestDistance = distance;
                        nearestSegment = segment;
                    }
                }
            }

            if (nearestSegment) {
                nearestSegment.addAttractionPoint(attractionPoint);
                selectedSegments.push(nearestSegment);
            }
        }

        return selectedSegments;
    }

    calculateAttractionsAndGrowAttractedSegments() {
        let newBranches;
        const aux = this.auxVector;
        const acc = this.accVector;

        for (const segment of this.obtainAttractedSegments()) {
            acc.clear();
            for (const point of segment.attractionPoints) {
                aux.copyFrom(point).sub(segment.pos).normalize();
                acc.add(aux);
            }
            acc.normalize();
            const angle = acc.angle - Math.PI / 2;

            const branchWidth = segment.finalWidth * NEXT_SEGMENT_WIDTH_RATIO;

            // decide whether can expand existing branch or if should spawn a new one
            if (segment.isTipOfBranch) {
                segment.branch.grow(angle);
            } else {
                if (!newBranches) {
                    newBranches = [];
                }

                acc.mul(0.001);
                acc.add(segment.pos);
                const newBranch = new Branch(acc.x, acc.y, angle, branchWidth);
                newBranches.push(newBranch);
            }
        }

        return newBranches;
    }

    removeDeadAttractionPoints() {
        /** @type {Number[]} */
        let usedAttractionsPointsByIndex = [];
        for (let pi = 0; pi < this.attractionPoints.length; pi++) {
            const attractionPoint = this.attractionPoints[pi];

            for (const branch of this.branches) {
                for (const segment of branch.segments) {
                    const distance = Vector.distance(attractionPoint, segment.pos);
                    if (distance < COLONIZATION_KILL_RADIUS) {
                        usedAttractionsPointsByIndex.push(pi);
                    }
                }
            }
        }
        // remove used attraction points
        for (const i of usedAttractionsPointsByIndex) {
            this.attractionPoints.splice(i, 1);
        }
    }

    update() {
        // clean up attraction point lists
        for (const branch of this.branches) {
            for (const segment of branch.segments) {
                segment.clearAttractionPoints();
            }
        }

        const newBranches = this.calculateAttractionsAndGrowAttractedSegments();

        this.removeDeadAttractionPoints();

        // ToDo should not grow again branches that have just grown due to attraction calculations above
        this.branches.forEach(branch => branch.update());

        if (newBranches) {  // intentionally adding after update above
            this.branches = this.branches.concat(newBranches);
        }
    }
}
