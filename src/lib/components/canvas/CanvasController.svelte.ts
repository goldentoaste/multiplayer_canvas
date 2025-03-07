import { joinSpace } from "$lib/realtime/space.svelte";
import { AABB, pointDistanceToLineSegment, Vector2 } from "$lib/Vector2";
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


    /**
     * returns true if p is colliding with this line, ie
     * distance of p to line is less thickness
     * @param p 
     */
    pointCollision(p0: Vector2) {

        if (this.aabb && !this.aabb.contains(p0)) {
            return false;
        }

        let prev = this.points[0];

        for (let i = 1; i < this.points.length; i++) {
            const tangentDist = pointDistanceToLineSegment(prev, this.points[i], p0);
            const segmentDist = this.points[i].distTo(prev) + this.thickness * 2;

            // point dist to line is less than limit
            // also check that p0 is sorta "between" the line segment points.
            if (tangentDist < (this.thickness + 1) && prev.distTo(p0) < segmentDist && this.points[i].distTo(p0) < segmentDist) {
                return true;
            }
            prev = this.points[i];
        }

        return false;
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

interface SimplePointerEvent {
    x: number;
    y: number;

    dx: number;
    dy: number;

    buttons: number;
}


export class CanvasController {

    staticCanvas: HTMLCanvasElement;
    dynamicCanvas: HTMLCanvasElement;

    cameraPos: Vector2;
    cameraZoom: number = 1;

    staticLines: Map<string, Line>; // lines that is already drawn, to be rendered on initial load, into canvas buffer
    dynamicLines: Map<string, Line>; // lines that is currently drawing, to be transfered to staticLines and render to buffer when done.

    ctxStatic: CanvasRenderingContext2D;
    ctxDynamic: CanvasRenderingContext2D;

    needStaticRender = true;
    needDynamicRender = true; // boolean flag to indicate if either needs rerendering

    selfCursor: Cursor | undefined = $state(undefined); // Cursor is a primitive obj, so should be deeply reactive by Svelte
    othersCursors: { [clientId: string]: Cursor } = $state({});


    space: Awaited<ReturnType<typeof joinSpace>> | undefined = $state();
    username: string | undefined = $state();
    currentLine: Line | undefined;

    lastFrameTime: number = 0;
    deltaTime: number = 0;
    cursorUpdateThreshold = 45; // 100ms for each web cursor update

    deleteMode = $state(false);
    toDelete: Line[] = [];


    constructor(staticCanvas: HTMLCanvasElement, dynamicCanvas: HTMLCanvasElement) {
        this.staticCanvas = staticCanvas;
        this.dynamicCanvas = dynamicCanvas;

        this.cameraPos = Vector2.ZERO;

        this.staticLines = new Map();
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

        this.finalizeDeletedLines(); ``


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

    finalizeDeletedLines() {
        if (this.deltaTime >= this.cursorUpdateThreshold) {

            if (this.toDelete.length > 0) {
                // broadcast results
                this.space?.deleteLines(this.toDelete.map(item => item.id));
            }


            // TODO uplaod to google
            // ...


            // done, clear deletes
            this.toDelete.length = 0;
        }
    }


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
            this.staticLines.set(line.id, line)
            this.dynamicLines.delete(user.id);
        }

        this.needDynamicRender = true;

    }

    handleDeletes(idsToDelete: string[]) {
        for (const id of idsToDelete) {
            this.staticLines.delete(id);
        }
        this.needStaticRender = true;
    }




    startRealTime() {
        joinSpace(undefined,
            (e) => {
                this.handleCursorUpdate(e);
            },
            (e) => {
                this.handleDeletes(e);
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
            const event: SimplePointerEvent = {
                x: e.offsetX,
                y: e.offsetY,

                dx: e.movementX,
                dy: e.movementY,

                buttons: e.buttons
            }
            if (e.buttons === 0) {
                this.mouseHover(event);
            }
            else if (e.buttons === 1) {
                this.mouseDrag(event);
            } else if (e.buttons === 4) {
                this.mousepan(event)
            }
        })

        this.dynamicCanvas.addEventListener("mouseup", (e) => {
            const event: SimplePointerEvent = {
                x: e.offsetX,
                y: e.offsetY,

                dx: e.movementX,
                dy: e.movementY,

                buttons: e.buttons
            }
            this.mouseup(event);
        });



        // touch related
        this.dynamicCanvas.addEventListener("touchstart", (e) => {
            if (e.touches.length == 1) {
                const t = e.touches[0];
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                this.lastX = t.clientX - rect.left;
                this.lastY = t.clientY - rect.top;
            }
        })


        this.dynamicCanvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            let t: Touch | undefined;
            let event: SimplePointerEvent | undefined;

            if (e.touches.length > 0) {
                t = e.touches[0];
                event = {
                    x: t.clientX - rect.left,
                    y: t.clientY - rect.top,
                    buttons: -1, // touch doesn't have buttons
                    dx: -9999, dy: -9999
                };

                if (this.lastX === -9999) {
                    event.dx = 0;
                    event.dy = 0;
                } else {
                    event.dx = (event.x - this.lastX);
                    event.dy = (event.y - this.lastY);
                }
            }

            if (e.touches.length == 1) {
                this.mouseDrag(event!);
            }
            else if (e.touches.length == 2) {

                this.mousepan(event!);
            }

            this.lastX = event?.x ?? -9999;
            this.lastY = event?.y ?? -9999;
        })

        this.dynamicCanvas.addEventListener("touchend", (e) => {
            if (e.touches.length == 0) {
                this.mouseup({
                    x: this.lastX ?? -9999,
                    y: this.lastY ?? -9999,
                    buttons: -1,
                    dx: 0,
                    dy: 0
                })
            }

        })
    }

    lastX = -9999;
    lastY = -9999;



    uploadCursorInfo(e: SimplePointerEvent, force = false) {
        if (!this.space || !this.selfCursor) {
            return;
        }

        if (force || this.deltaTime > this.cursorUpdateThreshold) {
            this.space.updateCursor(e.x + this.cameraPos.x, e.y + this.cameraPos.y, {
                username: this.username,
                color: this.selfCursor.color,
                id: this.selfCursor.id
            }, this.currentLine?.serialize());
        }
    }

    mousepan(e: SimplePointerEvent) {
        const diff = new Vector2(e.dx, e.dy);
        this.cameraPos = this.cameraPos.sub(diff);

        if (this.selfCursor) {

            this.selfCursor.pos = this.selfCursor?.pos.add(diff);
        }
        Object.values(this.othersCursors).forEach(item => item.pos = item.pos.add(diff));

        this.needDynamicRender = true;
        this.needStaticRender = true;
    }

    mouseup(e: SimplePointerEvent) {
        if (!this.currentLine) {
            return;
        }

        // smooth n reduce
        this.currentLine.pointsCulling(0.5, 1);
        this.staticLines.set(this.currentLine.id, this.currentLine);
        this.dynamicLines.delete(this.currentLine.id);
        // broadcast the smoothed version
        this.uploadCursorInfo(e, true);


        this.currentLine = undefined;
        this.needStaticRender = true;
        this.needDynamicRender = true;
        // TODO upload results to perm storage
    }

    mouseHover(e: SimplePointerEvent) {
        if (this.selfCursor)
            this.selfCursor.pos = new Vector2(e.x, e.y);
        this.uploadCursorInfo(e);
    }


    mouseDrag(e: SimplePointerEvent) {
        // TODO color and thickness modifier

        if (this.deleteMode) {
            // delete colliding lines
            this.deleteCollidedLines(new Vector2(e.x, e.y).add(this.cameraPos));

            if (this.selfCursor)
                this.selfCursor.pos = new Vector2(e.x, e.y);
            return;
        }

        if (!this.currentLine) {
            this.currentLine = new Line(crypto.randomUUID(), 4, "black", []);
        }

        if (this.selfCursor)
            this.selfCursor.pos = new Vector2(e.x, e.y);


        this.currentLine.appendPoint(new Vector2(e.x, e.y).add(this.cameraPos));
        this.dynamicLines.set(this.currentLine.id, this.currentLine);
        this.needDynamicRender = true;

        this.uploadCursorInfo(e);

    }


    deleteCollidedLines(p: Vector2) {

        for (const line of this.staticLines.values()) {
            if (line.pointCollision(p)) {
                this.toDelete.push(line);
            }
        }

        for (const line of this.toDelete) {
            this.staticLines.delete(line.id);
        }

        if (this.toDelete.length > 0) {
            this.needStaticRender = true;
        }

        // TODO broadcast delete message

        // TODO delete in firebase
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

        for (const line of this.staticLines.values()) {
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