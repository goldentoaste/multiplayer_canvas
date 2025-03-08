import type { Line } from "$lib/components/canvas/CanvasController.svelte";
import { fetchLines } from "./api";


export class CanvasFirebaseController {

    additionQueue: Line[] = [];
    deletionQueue: Line[] = [];

    constructor() {

    }


    async fullFetch() {
        await fetchLines();
    }

}