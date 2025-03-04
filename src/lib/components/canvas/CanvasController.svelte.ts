import { Vector2 } from "$lib/Vector2";

class Line {
    id: string;
    thickness: number; // in px
    color: string; // html color name or hex
    points: Vector2[];

    constructor(id: string, thickness: number, color: string, points: Vector2[]) {
        this.id = id;
        this.thickness = thickness;
        this.color = color;
        this.points = points;
    }

    appendPoint(point: Vector2) {
        this.points.push(point);
    }

    /**
     * ctx should have already been translated to account for camera, before calling this render
     * 
     * NOTE: 
     * For global rendering (canvas as big as the world), move ctx to world origin
     * For local rendering (canvas is camera viewport), ctx should be moved to negate camera position
     * This way, line render code can just use global coordinates and thus reuse code.
     * @param ctx 
     */
    render(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        if (this.points.length < 2) {
            return; // no points to render
        }


        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.thickness;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (const p of this.points) {
            ctx.lineTo(p.x, p.y); // global position
        }

        ctx.stroke(); // done!
    }

    pointsCulling(maxPoints: number, epsilon: number) {
        // TODO cull points within epsilon of each other so until total points is less than max
    }
}

/**
 * While CanvasController tracks cursor locations, it does not render.
 * Cursors should be a SVelte component instead.
 */
export interface Cursor {
    id: string;
    username: string; // need not be unique
    color: string;
    pos: Vector2;
}

// max size of the offscreen canvas, from origin to edge
// the realsize is doubled (+/- directions)
const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 4000;


export class CanvasController {

    staticCanvas: HTMLCanvasElement;
    dynamicCanvas: HTMLCanvasElement;

    cameraPos: Vector2;
    cameraZoom: number = 1;

    staticLines: Line[]; // lines that is already drawn, to be rendered on initial load, into canvas buffer
    dynamicLines: Line[]; // lines that is currently drawing, to be transfered to staticLines and render to buffer when done.

    ctxStatic: CanvasRenderingContext2D;
    ctxDynamic: CanvasRenderingContext2D;

    needStaticRender = false;
    needDynamicRender = false; // boolean flag to indicate if either needs rerendering

    selfCursor: Cursor | undefined = $state(undefined); // Cursor is a primitive obj, so should be deeply reactive by Svelte
    othersCuror: Cursor[] = $state([]);

    headlessCanvas: OffscreenCanvas; // canvas buffer to store the entire canvas, "staticCanvas" just shows a part of this one.
    ctxHeadless: OffscreenCanvasRenderingContext2D;




    constructor(staticCanvas: HTMLCanvasElement, dynamicCanvas: HTMLCanvasElement) {
        this.staticCanvas = staticCanvas;
        this.dynamicCanvas = dynamicCanvas;

        this.cameraPos = Vector2.ZERO;

        this.staticLines = [];
        this.dynamicLines = []; // TODO, fetch from db

        this.ctxStatic = this.staticCanvas.getContext("2d")!;
        this.ctxDynamic = this.dynamicCanvas.getContext("2d")!;

        this.headlessCanvas = new OffscreenCanvas(CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2);
        this.ctxHeadless = this.headlessCanvas.getContext("2d")!;
    }


    /**
     * re-render the entire global headless canvas.
     * Should be used sparingly
     */
    renderHeadlessAll() {
        const ctx = this.ctxHeadless;

        ctx.resetTransform();
        ctx.clearRect(0, 0, CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2);
        ctx.translate(CANVAS_WIDTH, CANVAS_HEIGHT); // translate to center of the headless canvas, the world origin

        for (const line of this.staticLines) {
            line.render(ctx);
        }
    }


    /**
     * only render a single line into the headless buffer
     * @param line 
     */
    renderHeadlessLine(line: Line) {
        const ctx = this.ctxHeadless;
        ctx.resetTransform();
        ctx.translate(CANVAS_WIDTH, CANVAS_HEIGHT); // translate to center of the headless canvas, the world origin

        line.render(ctx);
    }

    renderStatic(){
        if(!this.needStaticRender){
            return;
        }
        const translated = Vector2.ZERO.addp(CANVAS_WIDTH, CANVAS_HEIGHT).add(this.cameraPos);

        const data =  this.ctxHeadless.getImageData(translated.x, translated.y, this.staticCanvas.width, this.staticCanvas.height);
        this.ctxStatic.putImageData(data, 0, 0); // transfer a section to display
    }


    renderDynamic(){
        if(!this.needDynamicRender){
            return;
        }

        const ctx = this.ctxDynamic;
        ctx.resetTransform();
        ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

        for(const line of this.dynamicLines){
            line.render(ctx);
        }
    }

    

    async createCursor(){
        // TODO
    }




}