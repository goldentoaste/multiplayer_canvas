export class Vector2 {

    x: number;
    y: number;


    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    static get ZERO() {
        return new Vector2(0, 0);
    }

    static get ONE() {
        return new Vector2(1, 1);
    }

    static get UNIT_X() {
        return new Vector2(1, 0);
    }

    static get UNIT_Y() {
        return new Vector2(0, 1);
    }

    toArr() {
        return [this.x, this.y];
    }

    toObj(){
        return {
            x:this.x,
            y:this.y
        }
    }

    static fromArr(arr: [number, number]) {
        return new Vector2(arr[0], arr[1]);
    }


    /**
     * add piece-wise
     * @param x 
     * @param y 
     */
    addp(x: number, y: number) {
        return new Vector2(this.x + x, this.y + y);
    }

    add(other: Vector2) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }


    /**
     * add in place
     * @param other 
     * @returns 
     */
    addi(other: Vector2) {
        this.x += other.x;
        this.y += other.y;
    }


    sub(other: Vector2) {
        return new Vector2(this.x - other.x, this.y - other.y);
    }


    mul(factor: number) {
        return new Vector2(this.x * factor, this.y * factor);
    }

    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    distTo(other: Vector2) {
        return other.sub(this).mag();
    }

    clone() {
        return new Vector2(this.x, this.y);
    }
}


export class AABB {


    topleft: Vector2;
    botright: Vector2;

    constructor(topleft: Vector2, botright: Vector2) {
        this.topleft = topleft;
        this.botright = botright;
    }

    contains(point: Vector2) {
        return (point.x >= this.topleft.x && point.y >= this.topleft.y && point.x <= this.botright.x && point.y <= this.botright.y);
    }

    /**
     * expand this AABB inplace to contain the given point
     * @param point 
     */
    expandToContain(point: Vector2) {
        this.topleft.x = Math.min(point.x, this.topleft.x);
        this.topleft.y = Math.min(point.y, this.topleft.y);
        this.botright.x = Math.max(point.x, this.botright.x);
        this.botright.y = Math.max(point.y, this.botright.y);
    }

    get x() {
        return this.topleft.x;
    }

    get y() {
        return this.topleft.y;
    }

    get width() {
        return this.botright.x - this.topleft.x;
    }

    get height() {
        return this.botright.y - this.topleft.y;
    }

}


/**
 * check the distance of point p to the line formed by l1 and l2
 * @param l1 
 * @param l2 
 * @param p 
 */
export function pointDistanceToLineSegment(l1: Vector2, l2: Vector2, p: Vector2) {
    // calculate distance via area of the triangle formed by the 2 points, then divide by base to get height, which distance from point to line
    // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
    const x0 = p.x, y0 = p.y;
    const x1 = l1.x, y1 = l1.y;
    const x2 = l2.x, y2 = l2.y;

    const area2 = Math.abs(
        ((y2 - y1) * x0) - ((x2 - x1) * y0) + x2 * y1 - y2 * x1
    );

    const base = l2.distTo(l1);

    return area2 / base;
}