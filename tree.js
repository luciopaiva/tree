
import Vector from "./vector.js";

/*
   A tree model is always 1 unit high and 2 wide. All constants below take that into account.
   The root is at 0,0.
 */
const CROWN_HEIGHT_IN_UNITS = 0.15;
const TRUNK_WIDTH_IN_UNITS = 0.3;
const N_ATTRACTION_POINTS = 500;
const MIN_BRANCH_WIDTH_RATIO = 0.1;  // min value allowed for `current width / base width` before branch stops growing
const GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE = 0.004;
const BRANCH_LENGTH_GROWTH_STEP_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * 1.4;  // distance between segments
const BRANCH_WIDTH_GROWTH_SPEED_IN_UNITS_PER_UPDATE = GENERAL_GROWTH_SPEED_IN_UNITS_PER_UDPATE * .4;
const MEANDER_ANGLE_IN_RADIANS = 15 / 180 * Math.PI;
const MEANDER_CYCLES_PER_SECOND = 2.5;
const MEANDER_CYCLES_PER_SECONDS_IN_RADIANS = Math.PI / 60 * MEANDER_CYCLES_PER_SECOND;
const SEGMENT_INITIAL_WIDTH_IN_UNITS = 0.01;  // width of a segment that has just born
const NEXT_SEGMENT_WIDTH_RATIO = .986;  // width of next segment is this fraction of the current one
const COLONIZATION_INFLUENCE_RADIUS = 0.26;
const COLONIZATION_KILL_RADIUS = 0.12;
const SEGMENT_SEARCH_STEP = 1;  // this will increase gap between branch spawns
const PI_OVER_2 = Math.PI / 2;
const TAU = Math.PI * 2;
const MIN_ANGLE_FOR_BRANCHING_IN_DEGREES = 8;  // set to 0 to disable restriction
const MAX_DOT_PRODUCT_FOR_BRANCHING = Math.cos(MIN_ANGLE_FOR_BRANCHING_IN_DEGREES / 180 * Math.PI);
const MIN_DOT_PRODUCT_FOR_BRANCHING = Math.cos((180 - MIN_ANGLE_FOR_BRANCHING_IN_DEGREES) / 180 * Math.PI);
const MIN_NORMALIZED_Y_TO_GROW = -1;  // set to -1 to disable restriction
const MAXIMUM_NUMBER_OF_BRANCHES = 100;
const NEW_BRANCH_WIDTH_RATIO = 0.5;  // width of new branch in relation to its parent's

// ToDo width of every segment should commence with i-th part of its final width and step i-th every update (so all branches finish growing together)
// ToDo turn the crown into an ellipse
// ToDo flat quad-tree to make the algorithm run faster
// ToDo compute leaf with sinusoidal sums and multiplications
// ToDo force angle that a new branch makes with its parent (use attractors only to know to which side it should grow)
// ToDo decide whether to completely remove the trunk meandering algorithm (it's not being effectively used)
// ToDo add leaf only to segments of a certain maximum width

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
        this.initialWidth = finalWidth * SEGMENT_INITIAL_WIDTH_IN_UNITS;
        this.width = this.initialWidth;
        this.attractionPoints = [];
        this.isTipOfBranch = true;
    }
    update() {
        if (this.width < this.finalWidth) {
            this.width = Math.min(this.width + BRANCH_WIDTH_GROWTH_SPEED_IN_UNITS_PER_UPDATE, this.finalWidth);
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
        this.currentWidth = this.baseWidth;

        /** @type {Segment[]} */
        this.segments = [new Segment(this, x, y, this.currentWidth)];

        this.minWidth = MIN_BRANCH_WIDTH_RATIO * this.baseWidth;

        this.angleTime = 0;
        this.angleSpeed = MEANDER_CYCLES_PER_SECONDS_IN_RADIANS;
        this.maxAngle = MEANDER_ANGLE_IN_RADIANS;

        /** This is used to certify that each branch will grow only once per update round */
        this.didGrow = false;
    }

    clearGrowthMarker() {
        const hadGrowthInLastPeriod = this.didGrow;
        this.didGrow = false;
        return hadGrowthInLastPeriod;
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

        const crownCenterY = CROWN_HEIGHT_IN_UNITS + (1 - CROWN_HEIGHT_IN_UNITS) / 2;

        // generate rectangle of random points projected as an ellipsis (with intended non-uniformity)
        // https://stackoverflow.com/a/5529230/778272
        this.attractionPoints = Array.from(Array(N_ATTRACTION_POINTS),
            () => {
                const angle = Math.random() * TAU;
                return new Vector(
                    Math.cos(angle),
                    crownCenterY + Math.sin(angle) * Math.random() * (1 - CROWN_HEIGHT_IN_UNITS) / 2
                )
            });
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
                if (this.branches.length >= MAXIMUM_NUMBER_OF_BRANCHES) {
                    // just in case something unexpected happens, so we don't crash the browser tab
                    continue;
                }

                // hack to prevent infinite branching (described in README.md)
                const previousSegment = segment.branch.segments[segment.branch.segments.indexOf(segment) - 1];  // ToDo save previous segment in every segment to avoid this lookup
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
                const branchWidth = segment.finalWidth * NEW_BRANCH_WIDTH_RATIO;
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

    clearAllAttractionPoints() {
        // clean up attraction point lists
        for (const branch of this.branches) {
            for (const segment of branch.segments) {
                segment.clearAttractionPoints();
            }
        }
    }

    update() {
        if (this.fullyGrown) {  // nothing to do - spare CPU time and return immediately
            return;
        }

        this.clearAllAttractionPoints();

        this.calculateAttractionsAndGrowAttractedSegments();

        this.removeDeadAttractionPoints();

        // branches updated during attraction section above won't be updated again here
        this.branches.forEach(branch => branch.update());

        // clear growth marks and check if it is fully grown
        let hadGrowthInLastPeriod = false;
        for (const branch of this.branches) {
            hadGrowthInLastPeriod |= branch.clearGrowthMarker();
        }
        this.fullyGrown = !hadGrowthInLastPeriod;
    }
}
