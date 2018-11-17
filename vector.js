
export default class Vector {

    constructor (x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.save();
    }

    save() {
        this.savedX = this.x;
        this.savedY = this.y;
        this.savedZ = this.z;
        return this;
    }

    restore() {
        this.x = this.savedX;
        this.y = this.savedY;
        this.z = this.savedZ;
        return this;
    }

    copyFrom(other) {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        return this;
    }

    /**
     * @param {Number|Vector} other
     * @returns {this}
     */
    add(other) {
        if (other instanceof Vector) {
            this.x += other.x;
            this.y += other.y;
            this.z += other.z;
        } else {
            this.x += other;
            this.y += other;
            this.z += other;
        }
        return this;
    }

    sub(other) {
        if (other instanceof Vector) {
            this.x -= other.x;
            this.y -= other.y;
            this.z -= other.z;
        } else {
            this.x -= other;
            this.y -= other;
            this.z -= other;
        }
        return this;
    }

    /**
     * @param {Number} scalar
     * @returns {this}
     */
    mul(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    /**
     * @param {Number} scalar
     * @returns {this}
     */
    div(scalar) {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
    }

    rotate(radians) {
        const x = this.x;
        const y = this.y;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        this.x = cos * x - sin * y;
        this.y = sin * x - cos * y;
    }

    get length() {
        return Math.hypot(this.x, this.y, this.z);
    }

    normalize() {
        const len = this.length;
        this.x /= len;
        this.y /= len;
        this.z /= len;
        return this;
    }

    /**
     * You may need to normalize the vectors first.
     *
     * @param {Vector} other
     * @returns {Number}
     */
    dot(other) {
        return Vector.dot(this, other);
    }

    /**
     * @param {Vector} other
     * @param {Vector} result
     * @return {this}
     */
    cross(other, result = this) {
        Vector.cross(this, other, result);
        return result;
    }

    toString() {
        return Array.from(this.d).join(" ");
    }

    /**
     * @param {Vector} a
     * @param {Vector} b
     * @param {Vector} result
     * @returns {Vector}
     */
    static cross(a, b, result) {
        result.x = a.y * b.z - a.z * b.y;
        result.y = a.z * b.x - a.x * b.z;
        result.z = a.x * b.y - a.y * b.x;
        return result;
    }

    /**
     * @param {Vector} a
     * @param {Vector} b
     * @returns {Number}
     */
    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    /**
     * @param {Vector} other
     * @returns {Vector}
     */
    static from(other) {
        return new Vector(other.x, other.y, other.z)
    }

    /**
     * @param {Vector} a
     * @param {Vector} b
     * @returns {Number}
     */
    static distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    /**
     * @param {Vector} a
     * @param {Vector} b
     * @returns {Number}
     */
    static squaredDistance(a, b) {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
    }
}
