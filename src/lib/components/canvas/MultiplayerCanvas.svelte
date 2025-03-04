<script lang="ts">
    import { joinSpace } from "$lib/realtime/space.svelte";
    import type { CursorUpdate } from "@ably/spaces";
    import { onDestroy, onMount } from "svelte";
    import { CanvasController } from "./CanvasController.svelte";

    interface CanvasProps {
        size?: { width: number; height: number };
        style?: string;
        username?:string;
    }

    let { size, style, username }: CanvasProps = $props();

    let cursors = $state({})

    function onCursorUpdate(e:CursorUpdate){
        console.log(e);
        cursors[e.clientId] = {
            x:e.position.x,
            y:e.position.y,
            color:e.data.color
        }
    }

    let space : Awaited<ReturnType<typeof joinSpace>> | undefined;

    onMount(async ()=>{
        space = await joinSpace(username, onCursorUpdate);
    });

    onDestroy(()=>{
        if(space){
            return space.unsubscribe();
        }
    });

    $effect(()=>{
        if(username !== undefined  && username.length > 0 && space){
            space.updateProfile(username);
        }
    })

    let staticCanvas: HTMLCanvasElement |undefined= $state()
    let dynamicCanvas: HTMLCanvasElement |undefined= $state()

    let canvasController = $derived.by(()=>{
        if(staticCanvas && dynamicCanvas && space){
            return new CanvasController(staticCanvas, dynamicCanvas);
        }
        return undefined;
    })

</script>

<div
    class="canvasContainer"
    style={`${style ?? ""} ${size ? `width: ${size.width}px; height: ${size.height}px;` : ""}`}
    onmousemove={(e)=>{
        space?.updateCursor(e.clientX, e.clientY, undefined);
    }}
>
    <canvas bind:this={staticCanvas} class="staticCanvas"></canvas>
    <canvas bind:this={dynamicCanvas} class="dynamicCanvas"></canvas>
    <div class="cursorContainer">

{#each Object.values(cursors) as cursor}
    <div class="block" style="--x:{cursor.x}px; --y:{cursor.y}px; --color:red"></div>
{/each}
    </div>
</div>

<style>
    .canvasContainer {
        position: relative;
    }

    .staticCanvas,
    .dynamicCanvas,
    .cursorContainer {
        width: 100%;
        height: 100%;
        position: absolute;
        left: 0;
        top: 0;
    }

    .block {
        position: absolute;
        left: var(--x);
        top: var(--y);
        background-color: var(--color);
        width: 1rem;
        height: 1rem;


    }
</style>
