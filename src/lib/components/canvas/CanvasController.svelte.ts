import { joinSpace } from "$lib/realtime/space.svelte";
import { Vector2 } from "$lib/Vector2";
import type { CursorData, CursorUpdate } from "@ably/spaces";
import { untrack } from "svelte";

export interface SerializedLineType {
    id: string, thickness: number, color: string, points: [number, number][]
}
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

    serialize() {
        return {
            id: this.id,
            thickness: this.thickness,
            color: this.color,
            points: this.points.map(item => item.toArr())
        } as SerializedLineType
    }

    static deserialize(obj: SerializedLineType) {
        return new Line(
            obj.id, obj.thickness, obj.color, obj.points.map(item => Vector2.fromArr(item))
        );
    }
}

/**
 * While CanvasController tracks cursor locations, it does not render.
 * Cursors should be a SVelte component instead.
 */
export class Cursor {
    id: string = $state("");
    username: string | undefined = $state();
    color: string = $state("");
    pos: Vector2 = $state.raw(Vector2.ZERO);
    constructor(id: string, color: string, username: string | undefined, pos: Vector2) {
        this.id = id;
        this.username = username;
        this.color = color;
        this.pos = pos;
    }
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
    dynamicLines: { [userId: string]: Line }; // lines that is currently drawing, to be transfered to staticLines and render to buffer when done.

    ctxStatic: CanvasRenderingContext2D;
    ctxDynamic: CanvasRenderingContext2D;

    needStaticRender = false;
    needDynamicRender = false; // boolean flag to indicate if either needs rerendering

    selfCursor: Cursor | undefined = $state(undefined); // Cursor is a primitive obj, so should be deeply reactive by Svelte
    othersCursors: { [clientId: string]: Cursor } = $state({});

    headlessCanvas: OffscreenCanvas; // canvas buffer to store the entire canvas, "staticCanvas" just shows a part of this one.
    ctxHeadless: OffscreenCanvasRenderingContext2D;

    space: Awaited<ReturnType<typeof joinSpace>> | undefined = $state();
    username: string | undefined = $state();
    currentLine: Line | undefined;

    lastFrameTime: number = 0;
    deltaTime: number = 0;
    cursorUpdateThreshold = 45; // 100ms for each web cursor update


    constructor(staticCanvas: HTMLCanvasElement, dynamicCanvas: HTMLCanvasElement) {
        this.staticCanvas = staticCanvas;
        this.dynamicCanvas = dynamicCanvas;

        this.cameraPos = Vector2.ZERO;

        this.staticLines = [];
        this.dynamicLines = {}; // TODO, fetch from db

        this.ctxStatic = this.staticCanvas.getContext("2d")!;
        this.ctxDynamic = this.dynamicCanvas.getContext("2d")!;

        this.headlessCanvas = new OffscreenCanvas(CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2);
        this.ctxHeadless = this.headlessCanvas.getContext("2d")!;




        $effect(() => {

            if (this.space && this.username) {
                this.space.updateProfile(this.username);
            }

            if (this.space && this.selfCursor) {
                untrack(() => {
                    this.selfCursor!.username = this.username;
                })

            }
        })

        this.initEvents();
        this.startRealTime();
        this.startRender();
    }

    // ============ Render loop ============
    startRender() {
        requestAnimationFrame(this.render.bind(this));
    }

    render() {
        this.updateDeltaTime();


        this.renderDynamic();
        this.renderStatic();
        // do things
        requestAnimationFrame(this.render.bind(this))
    }

    updateDeltaTime() {
        const currentTime = new Date().getTime();
        this.deltaTime = currentTime - this.lastFrameTime;
        if (this.deltaTime > this.cursorUpdateThreshold) {
            this.lastFrameTime = currentTime;
        }
    }


    // ============ End Render loop ============




    // ============ events ============

    handleCursorUpdate(e: CursorUpdate) {
        if (!e.data) {
            return;
        }

        const user = e.data.user as { id: string, username: string, color: string };
        const currentLine = e.data.currentLine as SerializedLineType | undefined;

        this.othersCursors[user.id] = {
            ...user,
            pos: new Vector2(e.position.x, e.position.y).add(this.cameraPos)
        }

        this.othersCursors = this.othersCursors;

        if (currentLine) {
            this.dynamicLines[user.id] = Line.deserialize(currentLine);
        }

        if (!currentLine && this.dynamicLines[user.id]) {
            this.needStaticRender = true;
            this.renderHeadlessLine(this.dynamicLines[user.id]);
            delete this.dynamicLines[user.id];
        }

        this.needDynamicRender = true;

    }



    startRealTime() {
        joinSpace(undefined,
            (e) => {
                this.handleCursorUpdate(e);
            }
        ).then((space) => {
            this.space = space;
            this.selfCursor = new Cursor(this.space.user.id,
                this.space.user.color,
                undefined,
                Vector2.ZERO)
        })


    }

    initEvents() {
        this.dynamicCanvas.addEventListener("mousemove", (e) => {

            if (e.buttons === 0) {
                this.mouseHover(e);
            }
            else if (e.buttons === 1) {
                this.mouseDrag(e);
            } else if (e.buttons === 4) {
                this.mousepan(e)
            }
        })

        this.dynamicCanvas.addEventListener("mouseup", (e) => {
            this.mouseup();
        })
    }

    uploadCursorInfo(e: MouseEvent) {
        if (!this.space || !this.selfCursor) {
            return;
        }

        if (this.deltaTime > this.cursorUpdateThreshold) {
            this.space.updateCursor(e.offsetX, e.offsetY, {
                username: this.username,
                color: this.selfCursor.color,
                id: this.selfCursor.id
            }, this.currentLine?.serialize());
        }
    }

    mousepan(e: MouseEvent) {
        const diff = new Vector2(e.movementX, e.movementY);
        this.cameraPos = this.cameraPos.sub(diff);

        if(this.selfCursor){

            this.selfCursor.pos = this.selfCursor?.pos.add(diff);
        }
        Object.values(this.othersCursors).forEach(item => item.pos = item.pos.add(diff));


        this.needDynamicRender = true;
        this.needStaticRender = true;
    }

    mouseup() {
        this.currentLine = undefined;
        // TODO upload results
    }

    mouseHover(e: MouseEvent) {


        if (this.selfCursor)
            this.selfCursor.pos = new Vector2(e.offsetX, e.offsetY);
        this.uploadCursorInfo(e)


    }

    mouseDrag(e: MouseEvent) {
        // TODO color and thickness modifier

        if (!this.currentLine) {
            this.currentLine = new Line(crypto.randomUUID(), 4, "black", []);
        }

        if (this.selfCursor)
            this.selfCursor.pos = new Vector2(e.offsetX, e.offsetY);


        this.currentLine.appendPoint(new Vector2(e.offsetX, e.offsetY).add(this.cameraPos));
        this.dynamicLines[this.currentLine.id] = this.currentLine;
        this.needDynamicRender = true;

        console.log(this.currentLine);


        this.uploadCursorInfo(e);



    }



    // ============ end events ============


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

    renderStatic() {
        if (!this.needStaticRender) {
            return;
        }
        const translated = Vector2.ZERO.addp(CANVAS_WIDTH, CANVAS_HEIGHT).add(this.cameraPos);

        const data = this.ctxHeadless.getImageData(translated.x, translated.y, this.staticCanvas.width, this.staticCanvas.height);
        this.ctxStatic.putImageData(data, 0, 0); // transfer a section to display

        this.needStaticRender = false;
    }

    renderDynamic() {
        if (!this.needDynamicRender) {
            return;
        }

        const ctx = this.ctxDynamic;
        ctx.clearRect(0, 0, this.dynamicCanvas.width, this.dynamicCanvas.height)
        ctx.resetTransform();
        ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

        for (const line of Object.values(this.dynamicLines)) {
            line.render(ctx);
        }

        this.needDynamicRender = false;
    }

    cleanup() {
        this.space?.unsubscribe();
    }

}