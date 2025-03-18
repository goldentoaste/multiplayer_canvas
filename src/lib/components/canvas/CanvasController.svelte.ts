import { CanvasFirebaseController } from "$lib/firebase/CanvasFirebaseController";
import { joinSpace } from "$lib/realtime/space.svelte";
import {
    AABB,
    camGlobalAABB,
    lerp,
    pointDistanceToLineSegment,
    smoothstep,
    toGlobalSpace,
    toScreenSpace,
    Vector2,
} from "$lib/Vector2";
import type { CursorData, CursorUpdate } from "@ably/spaces";
import { untrack } from "svelte";

export interface UserData {
    username: string;
    color: string;
    penInfo: PenInfo;
}

export interface PenInfo {
    penColor: string;
    penThickness: number;
    layer: number;
    smoothing: boolean;
    name?: string;
}

export interface SerializedLineType {
    id: string;
    thickness: number;
    color: string;
    points: [number, number][];
    layer: number;
}
export class Line {
    id: string;
    thickness: number; // in px
    color: string; // html color name or hex
    layer: number;
    points: Vector2[];
    aabb: AABB | undefined = undefined;
    constructor(id: string, thickness: number, color: string, layer: number, points: Vector2[]) {
        this.id = id;
        this.thickness = thickness;
        this.color = color;
        this.layer = layer;
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
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (const p of this.points) {
            ctx.lineTo(p.x, p.y); // global position
        }

        ctx.stroke(); // done!

        // for drawing debug AABB
        // if(this.aabb){
        //     ctx.lineWidth = 3;
        //     ctx.strokeStyle = "red";
        //     ctx.strokeRect(this.aabb.x, this.aabb.y, this.aabb.width, this.aabb.height);
        // }
    }

    /**
     * remove points that are epsilon within each other
     * @param epsilon
     */
    pointsCulling(epsilon: number, smoothRange: number, smooth: boolean) {
        for (let i = this.points.length - 1; i > 0; i--) {
            if (this.points[i].sub(this.points[i - 1]).mag() < epsilon) {
                this.points.splice(i, 1);
                i--; // skip the next point
            }
        }

        // construct the aabb during smoothing
        this.aabb = new AABB(this.points[0].clone(), this.points[0].clone());

        if (smooth) {
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
    }

    serialize() {
        return {
            id: this.id,
            thickness: this.thickness,
            color: this.color,
            layer: this.layer,
            points: this.points.map((item) => item.toArr()),
        } as SerializedLineType;
    }

    static deserialize(obj: SerializedLineType, makeAABB = false) {
        const line = new Line(
            obj.id,
            obj.thickness,
            obj.color,
            obj.layer,
            obj.points.map((item) => Vector2.fromArr(item)),
        );

        if (makeAABB) {
            line.makeAABB();
        }

        return line;
    }

    makeAABB() {
        this.aabb = new AABB(this.points[0].clone(), this.points[0].clone());

        for (const p of this.points) {
            this.aabb.expandToContain(p);
        }

        // expand aabb to fit line thickness, extra margin to be generous
        this.aabb.nudgeTopLeftp(-this.thickness * 1, -this.thickness * 1);
        this.aabb.nudgeBotRightp(this.thickness * 1, this.thickness * 1);
    }

    /**
     * returns true if p is colliding with this line, ie
     * distance of p to line is less thickness
     * @param p
     */
    pointCollision(p0: Vector2) {
        if (this.aabb && !this.aabb.containsPoint(p0)) {
            return false;
        }

        let prev = this.points[0];

        for (let i = 1; i < this.points.length; i++) {
            const tangentDist = pointDistanceToLineSegment(prev, this.points[i], p0);
            const segmentDist = this.points[i].distTo(prev) + this.thickness / 2;

            const d1 = prev.distTo(p0) < segmentDist;
            const d2 = this.points[i].distTo(p0) < segmentDist;
            const t = tangentDist < this.thickness + 1;

            // point dist to line is less than limit
            // also check that p0 is sorta "between" the line segment points.
            if (d1 || d2 || (t && d1 && d2)) {
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
    color: string = $state("black");
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

    cameraPos: Vector2; // used for logic
    smoothCameraPos: Vector2; // used for rendering only
    zoom: number = 1;
    smoothZoom: number = 1; // for rendering

    maxLayers: number;
    staticLines: Map<string, Line>[]; // lines that is already drawn, to be rendered on initial load, into canvas buffer
    dynamicLines: Map<string, Line>[]; // lines that is currently drawing, to be transfered to staticLines and render to buffer when done.

    ctxStatic: CanvasRenderingContext2D;
    ctxDynamic: CanvasRenderingContext2D;

    needStaticRender = true;

    selfCursor: Cursor | undefined = $state(undefined); // Cursor is a primitive obj, so should be deeply reactive by Svelte
    othersCursors: { [clientId: string]: Cursor } = $state({});

    space: Awaited<ReturnType<typeof joinSpace>> | undefined = $state();
    userdata: UserData | undefined = $state();
    currentLine: Line | undefined;

    lastFrameTime: number = 0;
    deltaTime: number = 0;
    cursorUpdateThreshold = 45; // 100ms for each web cursor update

    deleteMode = $state(false);
    toDelete: Line[] = [];

    firebaseController: CanvasFirebaseController;

    deletedLines = new Set<string>();

    constructor(staticCanvas: HTMLCanvasElement, dynamicCanvas: HTMLCanvasElement, maxLayers: number) {
        this.staticCanvas = staticCanvas;
        this.dynamicCanvas = dynamicCanvas;
        this.maxLayers = maxLayers;

        this.cameraPos = Vector2.ZERO;
        this.smoothCameraPos = Vector2.ZERO;

        this.staticLines = [];
        this.dynamicLines = []; // TODO, fetch from db

        for (let i = 0; i < maxLayers; i++) {
            this.staticLines.push(new Map());
            this.dynamicLines.push(new Map());
        }

        this.ctxStatic = this.staticCanvas.getContext("2d")!;
        this.ctxDynamic = this.dynamicCanvas.getContext("2d")!;

        $effect(() => {
            if (this.space && this.userdata) {
                this.space.updateProfile(this.userdata.username, this.userdata.color);
            }

            if (this.space && this.selfCursor) {
                untrack(() => {
                    this.selfCursor!.username = this.userdata?.username;
                    this.selfCursor!.color = this.userdata?.color ?? "red";
                });
            }
        });

        this.firebaseController = new CanvasFirebaseController();

        this.startStorage();
        this.initEvents();
        this.startRealTime();
        this.startRender();

        setInterval(() => {
            this.deletedLines.clear();
        }, 10000);
    }

    // ============ Render loop ============
    startRender() {
        requestAnimationFrame(this.eventLoop.bind(this));
    }

    eventLoop(t: number) {
        this.updateDeltaTime(t);

        this.firebaseController.update(t);
        this.finalizeDeletedLines();
        this.updateSmoothPos();
        this.render(); // checks and redners both static and dynamic lines

        // do things
        requestAnimationFrame(this.eventLoop.bind(this));
    }

    updateDeltaTime(t: number) {
        this.deltaTime = t - this.lastFrameTime;
        if (this.deltaTime > this.cursorUpdateThreshold) {
            this.lastFrameTime = t;
        }
    }

    finalizeDeletedLines() {
        if (this.deltaTime >= this.cursorUpdateThreshold) {
            if (this.toDelete.length > 0) {
                // broadcast results
                this.space?.deleteLines(this.toDelete.map((item) => item.id));
            }

            for (const line of this.toDelete) {
                this.firebaseController.deletionQueue.push(line.id);
            }

            // done, clear deletes
            this.toDelete.length = 0;
        }
    }

    updateSmoothPos() {
        const smoothFactor = 0.2;
        this.smoothCameraPos = Vector2.smoothstep(this.smoothCameraPos, this.cameraPos, smoothFactor);
        this.smoothZoom = smoothstep(this.smoothZoom, this.zoom, smoothFactor);

        // always render smooth movement isn't done yet.
        if (this.smoothCameraPos.distTo(this.cameraPos) > 0.1 || Math.abs(this.smoothZoom - this.zoom) > 0.0001) {
            this.needStaticRender = true;
        }
    }

    // ============ End Render loop ============

    zoomAtPoint(point: Vector2, newZoom: number) {
        if (newZoom > 2 || newZoom < 0.5) {
            return;
        }
        // assuming point is cursor location

        const x = point.x;
        const y = point.y;

        point = toGlobalSpace(point, this.cameraPos, this.zoom);
        this.cameraPos = point.sub(new Vector2(x / newZoom, y / newZoom));

        this.zoom = newZoom;

        this.needStaticRender = true;
    }

    // ============ events ============

    lastPos: Vector2 | undefined;
    initialTouchDist = 0;
    initialZoom = 0;
    initEvents() {
        this.dynamicCanvas.addEventListener("keyup", (e) => {
            if (e.key == "=") {
                this.zoomAtPoint(this.lastPos!, this.zoom + 0.2);
            } else if (e.key == "-") {
                this.zoomAtPoint(this.lastPos!, this.zoom - 0.2);
            }
        });

        this.dynamicCanvas.addEventListener("mousemove", (e) => {
            const event: SimplePointerEvent = {
                x: e.offsetX,
                y: e.offsetY,

                dx: e.movementX,
                dy: e.movementY,

                buttons: e.buttons,
            };

            if (e.buttons === 0) {
                this.mouseHover(event);
            } else if (e.buttons === 1) {
                if (!this.userdata?.penInfo.name) {
                    this.mousepan(event);
                } else {
                    this.mouseDrag(event);
                }
            } else if (e.buttons === 2) {
                this.mousepan(event);
            }
            this.lastPos = new Vector2(event.x, event.y);
        });

        this.dynamicCanvas.addEventListener("mouseup", (e) => {
            const event: SimplePointerEvent = {
                x: e.offsetX,
                y: e.offsetY,

                dx: e.movementX,
                dy: e.movementY,

                buttons: e.buttons,
            };
            this.mouseup(event);
        });

        // touch related
        this.dynamicCanvas.addEventListener("touchstart", (e) => {
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();

            if (e.touches.length == 1) {
                const t = e.touches[0];
                this.lastPos = new Vector2(t.clientX - rect.left, t.clientY - rect.top);
            } else if (e.touches.length == 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];

                const v1 = new Vector2(t1.clientX - rect.left, t1.clientY - rect.top);
                const v2 = new Vector2(t2.clientX - rect.left, t2.clientY - rect.top);
                this.lastPos = Vector2.midPoint(v1, v2);
                this.initialTouchDist = v1.distTo(v2);
                this.initialZoom = this.zoom;
            }

        });

        this.dynamicCanvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!this.lastPos) {
                return;
            }

            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();

            let event: SimplePointerEvent | undefined;

            if (e.touches.length == 1) {
                // one finger only move
                const _x = e.touches[0].clientX - rect.left;
                const _y = e.touches[0].clientY - rect.top;

                event = {
                    buttons: -1,
                    dx: -1,
                    dy: -1,
                    x: _x,
                    y: _y,
                };
                this.mouseDrag(event);

                this.lastPos = new Vector2(_x, _y);
            } else if (e.touches.length == 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const v1 = new Vector2(t1.clientX - rect.left, t1.clientY - rect.top);
                const v2 = new Vector2(t2.clientX - rect.left, t2.clientY - rect.top);
                const newDist = v1.distTo(v2);
                const currentPos = Vector2.midPoint(v1, v2);
                this.zoomAtPoint(currentPos, (newDist / this.initialTouchDist) * this.initialZoom);
                const diff = currentPos.sub(this.lastPos);

                this.lastPos = currentPos;

                event = {
                    buttons: -1,
                    dx: diff.x,
                    dy: diff.y,
                    x: currentPos.x,
                    y: currentPos.y,
                };

                this.mousepan(event);
            }
        });

        this.dynamicCanvas.addEventListener("touchend", (e) => {
            if (e.touches.length == 0) {
                this.mouseup({
                    x: 0,
                    y: 0,
                    buttons: -1,
                    dx: 0,
                    dy: 0,
                });
                // clean up
                this.lastPos = undefined;
                this.initialTouchDist = 0;
                this.initialZoom = 0;
            }
        });
    }

    async startStorage() {
        const lines = await this.firebaseController.fullFetch();

        // lines from db.
        for (const line of lines) {
            this.staticLines[line.layer]?.set(line.id, line);
        }

        // render
        this.needStaticRender = true;
    }

    handleCursorUpdate(e: CursorUpdate) {
        if (!e.data) {
            return;
        }

        const user = e.data.user as { id: string; username: string; color: string };

        if (user.id === this.selfCursor?.id) {
            return; // ignore own data to avoid overhead
        }

        const currentLine = e.data.currentLine as SerializedLineType | undefined;

        this.othersCursors[user.id] = {
            ...user,
            pos: toScreenSpace(new Vector2(e.position.x, e.position.y), this.cameraPos, this.zoom),
        };

        this.othersCursors = this.othersCursors;

        if (currentLine) {
            if (!this.deletedLines.has(currentLine.id)) {
                this.dynamicLines[currentLine.layer].set(currentLine.id, Line.deserialize(currentLine));
            } else {
                this.dynamicLines[currentLine.layer].delete(currentLine.id);
            }
        }
    }

    handleDeletes(idsToDelete: string[]) {
        for (const id of idsToDelete) {
            for (const layer of this.staticLines) {
                layer.delete(id);
            }
        }
        this.needStaticRender = true;
    }

    handleNewLine(userId: string, newLine: SerializedLineType) {
        this.needStaticRender = true;
        const line = Line.deserialize(newLine, true);
        this.staticLines[line.layer].set(line.id, line);
        this.dynamicLines[line.layer].delete(userId);

        this.deletedLines.add(newLine.id);
    }

    startRealTime() {
        joinSpace(
            undefined,
            this.handleCursorUpdate.bind(this),
            this.handleDeletes.bind(this),
            this.handleNewLine.bind(this),
        ).then((space) => {
            this.space = space;
            this.selfCursor = new Cursor(this.space.user.id, this.space.user.color, undefined, Vector2.ZERO);
        });
    }

    uploadCursorInfo(e: SimplePointerEvent, force = false) {
        if (!this.space || !this.selfCursor) {
            return;
        }

        if (force || this.deltaTime > this.cursorUpdateThreshold) {
            const gp = toGlobalSpace(new Vector2(e.x, e.y), this.cameraPos, this.zoom);
            this.space.updateCursor(
                gp.x,
                gp.y,
                {
                    username: this.userdata?.username,
                    color: this.selfCursor.color,
                    id: this.selfCursor.id,
                },
                this.currentLine?.serialize(),
            );
        }
    }

    mousepan(e: SimplePointerEvent) {
        const diff = new Vector2(e.dx, e.dy).div(this.zoom); // scale cam pos speed by zoom level
        this.cameraPos = this.cameraPos.sub(diff);

        if (this.selfCursor) {
            this.selfCursor.pos = this.selfCursor?.pos.addp(e.dx, e.dy);
        }
        Object.values(this.othersCursors).forEach((item) => (item.pos = item.pos.add(diff)));

        this.needStaticRender = true;
    }

    mouseup(e: SimplePointerEvent) {
        if (!this.currentLine) {
            return;
        }

        // smooth n reduce
        this.currentLine.pointsCulling(0.5, 1, this.userdata?.penInfo.smoothing ?? true);
        this.staticLines[this.currentLine.layer].set(this.currentLine.id, this.currentLine);
        this.dynamicLines[this.currentLine.layer].delete(this.currentLine.id);

        const line = this.currentLine;

        // broadcast new line to other realtime clients
        this.space?.newLine(line.serialize());

        // queue the item to be uploaded
        this.firebaseController.additionQueue.push(this.currentLine);

        // clean up
        this.currentLine = undefined;
        this.needStaticRender = true;
    }

    mouseHover(e: SimplePointerEvent) {
        if (this.selfCursor) {
            this.selfCursor.pos = new Vector2(e.x, e.y);
        }
        this.uploadCursorInfo(e);
    }

    mouseDrag(e: SimplePointerEvent) {
        // TODO color and thickness modifier

        if (this.deleteMode) {
            // delete colliding lines
            this.deleteCollidedLines(toGlobalSpace(new Vector2(e.x, e.y), this.cameraPos, this.zoom));

            if (this.selfCursor) {
                this.selfCursor.pos = new Vector2(e.x, e.y);
            }
            return;
        }

        if (!this.currentLine) {
            this.currentLine = new Line(
                crypto.randomUUID(),
                this.userdata?.penInfo.penThickness ?? 4,
                this.userdata?.penInfo.penColor ?? "black",
                this.userdata?.penInfo.layer ?? 0,
                [],
            );
        }

        if (this.selfCursor) {
            this.selfCursor.pos = new Vector2(e.x, e.y);
        }

        this.currentLine.appendPoint(toGlobalSpace(new Vector2(e.x, e.y), this.cameraPos, this.zoom));
        this.dynamicLines[this.currentLine.layer].set(this.currentLine.id, this.currentLine);

        this.uploadCursorInfo(e);
    }

    deleteCollidedLines(p: Vector2) {
        for (const layer of this.staticLines) {
            for (const line of layer.values()) {
                if (line.pointCollision(p)) {
                    this.toDelete.push(line);
                }
            }
        }

        for (const line of this.toDelete) {
            this.staticLines[line.layer].delete(line.id);
        }

        if (this.toDelete.length > 0) {
            this.needStaticRender = true;
        }
    }

    // ============ end events ============

    /**
     * handles render of both static and dynamic rendering, in layers
     */
    render() {
        // static
        if (this.needStaticRender) {
            this.ctxStatic.resetTransform();
            this.ctxStatic.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);
            this.ctxStatic.scale(this.smoothZoom, this.smoothZoom);
            this.ctxStatic.translate(-this.smoothCameraPos.x, -this.smoothCameraPos.y);
        }

        // dynamic (always)

        this.ctxDynamic.resetTransform();
        this.ctxDynamic.clearRect(0, 0, this.dynamicCanvas.width, this.dynamicCanvas.height);
        this.ctxDynamic.scale(this.smoothZoom, this.smoothZoom);
        this.ctxDynamic.translate(-this.smoothCameraPos.x, -this.smoothCameraPos.y);

        // optimization, don't render lines outside of view port
        const camAABB = camGlobalAABB(
            this.smoothCameraPos,
            this.dynamicCanvas.width,
            this.dynamicCanvas.height,
            this.smoothZoom,
        );

        // process each layer
        for (let layer = 0; layer < this.maxLayers; layer++) {
            if (this.needStaticRender) {
                for (const line of this.staticLines[layer].values()) {
                    // skip out of view lines.
                    if (camAABB.cornerContain(line.aabb)) {
                        line.render(this.ctxStatic);
                    }
                }
            }

            for (const [id, line] of this.dynamicLines[layer].entries()) {
                line.render(this.ctxDynamic);

                if (this.deletedLines.has(line.id)) {
                    this.dynamicLines[layer].delete(id);
                }
            }
        }

        // done

        this.needStaticRender = false;
    }

    cleanup() {
        this.space?.unsubscribe();
    }
}
