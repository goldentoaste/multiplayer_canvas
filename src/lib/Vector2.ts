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

    toArr(){
        return [this.x, this.y];
    }

    static fromArr(arr:[number, number]){
        return new Vector2(arr[0], arr[1]);
    }


    /**
     * add piece-wise
     * @param x 
     * @param y 
     */
    addp(x:number, y:number){
        return new Vector2(this.x + x, this.y + y);
    }

    add(other: Vector2) {
        return new Vector2(this.x + other.x, this.y + other.y);
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



}