
import Vector from "./vector.js";

/*
   A tree model is always 1 unit high and 2 wide. All constants below take that into account.
   The root is at 0,0.
 */
const CROWN_HEIGHT_IN_UNITS = 0.15;
const TRUNK_WIDTH_IN_UNITS = 0.2;
const N_ATTRACTION_POINTS = 300;
const MIN_BRANCH_WIDTH_RATIO = 0.2;  // min value allowed for `current width / base width` before branch stops growing
const GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE = 0.004;
const BRANCH_LENGTH_GROWTH_STEP_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * 1.4;  // distance between segments
const BRANCH_WIDTH_GROWTH_SPEED_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * .4;
const MEANDER_ANGLE_IN_RADIANS = 15 / 180 * Math.PI;
const MEANDER_CYCLES_PER_SECOND = 2.5;
const MEANDER_CYCLES_PER_SECONDS_IN_RADIANS = Math.PI / 60 * MEANDER_CYCLES_PER_SECOND;
const SEGMENT_INITIAL_WIDTH_IN_UNITS = 0.03;  // width of a segment that has just born
const NEXT_SEGMENT_WIDTH_RATIO = .986;  // width of next segment is this fraction of the current one
const COLONIZATION_INFLUENCE_RADIUS = 0.4;
const COLONIZATION_KILL_RADIUS = 0.15;
const SEGMENT_SEARCH_STEP = 1;  // this will increase gap between branch spawns
const PI_OVER_2 = Math.PI / 2;
const MIN_ANGLE_FOR_BRANCHING_IN_DEGREES = 8;
const MAX_DOT_PRODUCT_FOR_BRANCHING = Math.cos(MIN_ANGLE_FOR_BRANCHING_IN_DEGREES / 180 * Math.PI);
const MIN_DOT_PRODUCT_FOR_BRANCHING = Math.cos((180 - MIN_ANGLE_FOR_BRANCHING_IN_DEGREES) / 180 * Math.PI);
const MIN_NORMALIZED_Y_TO_GROW = -0.4;

let nextBranchId = 1;
let auxVectorRight = new Vector(1, 0);  // unit vector pointing right (for angle computations)

class Segment {
    /**
     * A segment of a branch. x,y are its world coordinates and growthFactor will determine segment's final width.
     * Segments closer to the branch tip will have lower growth factors, causing branches to become thinner as they
     * grow longer.
     *
     * @param branch
     * @param x
     * @param y
     * @param finalWidth
     */
    constructor (branch, x, y, finalWidth) {
        this.branch = branch;
        this.pos = new Vector(x, y);
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
    constructor (x, y, baseAngle, baseWidth, isTrunk = false) {
        this.id = nextBranchId++;

        this.baseAngle = baseAngle;
        this.baseWidth = baseWidth;
        this.isTrunk = isTrunk;

        /** @type {Segment[]} */
        this.segments = [new Segment(this, x, y, this.currentWidth)];

        this.minWidth = MIN_BRANCH_WIDTH_RATIO * this.baseWidth;
        this.currentWidth = this.baseWidth;

        this.angleTime = 0;
        this.angleSpeed = MEANDER_CYCLES_PER_SECONDS_IN_RADIANS;
        this.maxAngle = MEANDER_ANGLE_IN_RADIANS;

        /** This is used to certify that each branch will grow only once per update round */
        this.didGrow = false;
    }

    clearGrowthMarker() {
        this.didGrow = false;
    }

    getTip() {
        return this.segments[this.segments.length - 1];
    }

    /**
     * @param {Number} [angle] - if given, will be used as the absolute angle in radians used to calculate next
     *                           segment's position
     */
    grow(angle) {
        const tip = this.segments[this.segments.length - 1];

        let segmentAngle;

        if (angle) {
            segmentAngle = angle;
        } else {
            // no specific angle was provided - calculate meandering angle
            angle = Math.sin(this.angleTime) * this.maxAngle;         // fundamental frequency at 100% amplitude
            angle += Math.sin(2 * this.angleTime) * 0.8 * this.maxAngle;  // first octave at 80% amplitude
            segmentAngle = this.baseAngle + angle;
        }

        const aux = auxVectorRight.restore();
        aux.rotate(segmentAngle);
        aux.mul(BRANCH_LENGTH_GROWTH_STEP_IN_UNITS_PER_UPDATE);
        aux.add(tip.pos);

        this.segments.push(new Segment(this, aux.x, aux.y, this.currentWidth));

        tip.isTipOfBranch = false;  // no longer the tip

        // update step variables
        this.angleTime += this.angleSpeed;
        this.currentWidth *= NEXT_SEGMENT_WIDTH_RATIO;

        this.didGrow = true;
    }

    update(growthAngle) {
        if (this.didGrow) {
            return;
        }

        this.segments.forEach(segment => segment.update());

        // we don't want the trunk to keep growing after the initial phase, unless it's being attracted
        const trunkIsTooBigForNaturalGrowth = this.isTrunk && this.currentWidth < this.minWidth && !growthAngle;
        // branches are not allowed to grow unless an angle was provided
        const isBranchTryingToGrowNaturally = !this.isTrunk && !growthAngle;
        if (trunkIsTooBigForNaturalGrowth || isBranchTryingToGrowNaturally) {
            return;
        }

        this.grow(growthAngle);
    }
}

export default class Tree {

    constructor () {
        /** @type {Branch[]} */
        this.branches = [];
        const trunk = new Branch(0, 0, PI_OVER_2, TRUNK_WIDTH_IN_UNITS, true);
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
        // more than one attractor can point to the same segment, so use a set to remove duplicate entries
        /** @type {Set<Segment>} */
        let selectedSegments = new Set();

        for (let pi = 0; pi < this.attractionPoints.length; pi++) {
            const attractionPoint = this.attractionPoints[pi];

            // ToDo if point is not at COLONIZATION_INFLUENCE_RADIUS from tree's bounding box, skip

            /** @type {Segment} */
            let nearestSegment = null;
            let shortestDistance = Number.POSITIVE_INFINITY;

            for (const branch of this.branches) {
                // intentionally skip segment 0 since it coincides with one of this branch's parent segments
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
                selectedSegments.add(nearestSegment);
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

            if (acc.y < MIN_NORMALIZED_Y_TO_GROW) {
                continue;  // kill branches that try to grow down (they don't look natural)
            }

            const angle = acc.angle;

            // decide whether can expand existing branch or if should spawn a new one
            if (segment.isTipOfBranch) {
                segment.branch.update(angle);
            } else {
                // hack to prevent infinite branching (described in README.md)
                const previousSegment = segment.branch.segments[0];  // segment.branch.segments[segment.branch.segments.indexOf(segment) - 1];
                aux.copyFrom(segment.pos).sub(previousSegment.pos).normalize();
                const dot = acc.dot(aux);
                if (dot > MAX_DOT_PRODUCT_FOR_BRANCHING ||  // branch direction is too similar to its parent
                    dot < MIN_DOT_PRODUCT_FOR_BRANCHING) {  // branch too dissimilar!
                    continue;
                }

                if (!newBranches) {
                    newBranches = [];
                }

                // ToDo use pythagoras to determine new branch's width (see paper)
                const branchWidth = segment.finalWidth * NEXT_SEGMENT_WIDTH_RATIO;
                // first branch segment coincides with segment from parent's branch
                const newBranch = new Branch(segment.pos.x, segment.pos.y, angle, branchWidth);
                newBranch.update(angle);
                newBranches.push(newBranch);
            }
        }

        if (newBranches) {
            // can only add new branches after finishing loop above, otherwise we'll end up growing the new ones once again
            this.branches = this.branches.concat(newBranches);
        }
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
        for (const i of usedAttractionsPointsByIndex.reverse()) {
            this.attractionPoints.splice(i, 1);
        }
    }

    update() {
        // clean up attraction point lists
        for (const branch of this.branches) {
            branch.clearGrowthMarker();
            for (const segment of branch.segments) {
                segment.clearAttractionPoints();
            }
        }

        this.calculateAttractionsAndGrowAttractedSegments();

        this.removeDeadAttractionPoints();

        // branches updated during attraction section above won't be updated again here
        this.branches.forEach(branch => branch.update());
    }
}
