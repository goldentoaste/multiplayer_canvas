import { Line } from "$lib/components/canvas/CanvasController.svelte";
import { Timestamp } from "@firebase/firestore/lite";
import { deleteLines, fetchLines, uploadLines, type FirebaseLine } from "./api";




export class CanvasFirebaseController {

    additionQueue: Line[] = [];
    deletionQueue: string[] = [];

    lastUpdateTime: number = 0;
    updateThreshold: number = 2000;

    constructor() {

    }

    async fullFetch() {
        const lines: { [id: string]: FirebaseLine } = await fetchLines();


        const out: Line[] = [];

        // convert Firebase line to line
        for (const line of Object.values(lines)) {
            out.push(
                Line.deserialize({
                    id: line.id,
                    color: line.color,
                    thickness: line.thickness,
                    points: line.points.map(item => [item.x, item.y]),
                    layer: line.layer
                }, true)
            )
        }

        return out;
    }


    update(t: number) {
        const delta = t - this.lastUpdateTime;
        if (delta < this.updateThreshold) {
            return;
        }

        this.lastUpdateTime = t;

        if (this.additionQueue.length > 0) {
            // upload
            uploadLines(this.additionQueue.map(item => {
                return {
                    id: item.id,
                    color: item.color,
                    createdOn: Timestamp.now(),
                    thickness: item.thickness,
                    points: item.points.map(p => p.toObj()),
                    layer: item.layer
                }
            }))
            this.additionQueue.length = 0;
        }


        if (this.deletionQueue.length > 0) {
            deleteLines(this.deletionQueue);
            this.deletionQueue.length = 0;
        }
    }



}