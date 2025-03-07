import { joinSpace } from "$lib/realtime/space.svelte";
import { AABB, Vector2 } from "$lib/Vector2";
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
    aabb: AABB | undefined = undefined;
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
        ctx.lineJoin = 'round'

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (const p of this.points) {
            ctx.lineTo(p.x, p.y); // global position
        }

        ctx.stroke(); // done!
    }


    /**
     * remove points that are epsilon within each other
     * @param epsilon 
     */
    pointsCulling(epsilon: number, smoothRange: number) {
        for (let i = this.points.length - 1; i > 0; i--) {
            if (this.points[i].sub(this.points[i - 1]).mag() < epsilon) {
                this.points.splice(i, 1);
                i--; // skip the next point
            }
        }

        // construct the aabb during smoothing
        this.aabb = new AABB(this.points[0].clone(), this.points[0].clone());


        // smooth the remaining points
        for (let i = 0; i < this.points.length; i++) {
            let sum = Vector2.ZERO;

            const start = Math.max(0, i - smoothRange);
            const end = Math.min(i + smoothRange, this.points.length);

            for (let j = start; j < end; j++) {
                sum.addi(this.points[j]);
            }

            this.points[i] = sum.mul(1 / (end - start));
            this.aabb.expandToContain(this.points[i]);
        }
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

    makeAABB() {
        this.aabb = new AABB(this.points[0].clone(), this.points[0].clone());

        for (const p of this.points) {
            this.aabb.expandToContain(p);
        }
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
    dynamicLines: Map<string, Line>; // lines that is currently drawing, to be transfered to staticLines and render to buffer when done.

    ctxStatic: CanvasRenderingContext2D;
    ctxDynamic: CanvasRenderingContext2D;

    needStaticRender = false;
    needDynamicRender = false; // boolean flag to indicate if either needs rerendering

    selfCursor: Cursor | undefined = $state(undefined); // Cursor is a primitive obj, so should be deeply reactive by Svelte
    othersCursors: { [clientId: string]: Cursor } = $state({});


    space: Awaited<ReturnType<typeof joinSpace>> | undefined = $state();
    username: string | undefined = $state();
    currentLine: Line | undefined;

    lastFrameTime: number = 0;
    deltaTime: number = 0;
    cursorUpdateThreshold = 45; // 100ms for each web cursor update

    deleteMode = $state(false);


    constructor(staticCanvas: HTMLCanvasElement, dynamicCanvas: HTMLCanvasElement) {
        this.staticCanvas = staticCanvas;
        this.dynamicCanvas = dynamicCanvas;

        this.cameraPos = Vector2.ZERO;

        this.staticLines = [];
        this.dynamicLines = new Map(); // TODO, fetch from db

        this.ctxStatic = this.staticCanvas.getContext("2d")!;
        this.ctxDynamic = this.dynamicCanvas.getContext("2d")!;

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
        if (user.id === this.selfCursor?.id) {
            return; // ignore own data to avoid overhead
        }

        const currentLine = e.data.currentLine as SerializedLineType | undefined;

        this.othersCursors[user.id] = {
            ...user,
            pos: new Vector2(e.position.x, e.position.y).sub(this.cameraPos)
        }

        this.othersCursors = this.othersCursors;

        if (currentLine) {
            this.dynamicLines.set(user.id, Line.deserialize(currentLine));
        }

        if (!currentLine && this.dynamicLines.has(user.id)) {
            this.needStaticRender = true;
            const line = this.dynamicLines.get(user.id)!;
            line.makeAABB(); //jank
            this.staticLines.push(line);
            this.dynamicLines.delete(user.id);
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
            this.mouseup(e);
        })
    }

    uploadCursorInfo(e: MouseEvent, force=false) {
        if (!this.space || !this.selfCursor) {
            return;
        }

        if ( force || this.deltaTime > this.cursorUpdateThreshold) {
            this.space.updateCursor(e.offsetX + this.cameraPos.x, e.offsetY + this.cameraPos.y, {
                username: this.username,
                color: this.selfCursor.color,
                id: this.selfCursor.id
            }, this.currentLine?.serialize());
        }
    }

    mousepan(e: MouseEvent) {
        const diff = new Vector2(e.movementX, e.movementY);
        this.cameraPos = this.cameraPos.sub(diff);

        if (this.selfCursor) {

            this.selfCursor.pos = this.selfCursor?.pos.add(diff);
        }
        Object.values(this.othersCursors).forEach(item => item.pos = item.pos.add(diff));

        this.needDynamicRender = true;
        this.needStaticRender = true;
    }

    mouseup(e: MouseEvent) {
        if (!this.currentLine) {
            return;
        }

        // smooth n reduce
        this.currentLine.pointsCulling(0.5, 1);
        this.staticLines.push(this.currentLine);
        this.dynamicLines.delete(this.currentLine.id);
        // broadcast the smoothed version
        this.uploadCursorInfo(e, true);


        this.currentLine = undefined;
        this.needStaticRender = true;
        this.needDynamicRender = true;
        // TODO upload results to perm storage
    }

    mouseHover(e: MouseEvent) {
        if (this.selfCursor)
            this.selfCursor.pos = new Vector2(e.offsetX, e.offsetY);
        this.uploadCursorInfo(e);
    }

    mouseDrag(e: MouseEvent) {
        // TODO color and thickness modifier

        if (!this.currentLine) {
            this.currentLine = new Line(crypto.randomUUID(), 4, "black", []);
        }

        if (this.selfCursor)
            this.selfCursor.pos = new Vector2(e.offsetX, e.offsetY);


        this.currentLine.appendPoint(new Vector2(e.offsetX, e.offsetY).add(this.cameraPos));
        this.dynamicLines.set(this.currentLine.id, this.currentLine);
        this.needDynamicRender = true;

        this.uploadCursorInfo(e);

    }



    // ============ end events ============



    renderStatic() {
        if (!this.needStaticRender) {
            return;
        }

        const ctx = this.ctxStatic;
        ctx.resetTransform();
        ctx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height)
        ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

        for (const line of Object.values(this.staticLines)) {
            line.render(ctx);
        }

        this.needStaticRender = false;
    }

    renderDynamic() {
        if (!this.needDynamicRender) {
            return;
        }

        const ctx = this.ctxDynamic;
        ctx.resetTransform();
        ctx.clearRect(0, 0, this.dynamicCanvas.width, this.dynamicCanvas.height)
        ctx.translate(-this.cameraPos.x, -this.cameraPos.y);


        for (const line of this.dynamicLines.values()) {
            line.render(ctx);

        }

        this.needDynamicRender = false;
    }

    cleanup() {
        this.space?.unsubscribe();
    }

}