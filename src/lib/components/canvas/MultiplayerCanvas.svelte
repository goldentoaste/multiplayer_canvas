<script lang="ts">
    import { CanvasController } from "./CanvasController.svelte";
    import UserCursor from "../Cursor/UserCursor.svelte";
    import { onDestroy } from "svelte";

    interface CanvasProps {
        size?: { width: number; height: number };
        style?: string;
        username?: string;
    }

    let { size, style, username }: CanvasProps = $props();

    let staticCanvas: HTMLCanvasElement | undefined = $state();
    let dynamicCanvas: HTMLCanvasElement | undefined = $state();

    let canvasController = $derived.by(() => {
        if (staticCanvas && dynamicCanvas) {
            return new CanvasController(staticCanvas, dynamicCanvas);
        }
        return undefined;
    });

    $effect(() => {
        if (canvasController && username) {
            canvasController.username = username;
        }
    });

    onDestroy(()=>{
        if(canvasController){
            canvasController.cleanup();
        }
    })

 
</script>

<span>Delete mode: {canvasController?.deleteMode}</span> <button onclick="{()=>{
    canvasController && (canvasController.deleteMode = !canvasController.deleteMode)
}}">toggle delete</button>
<div
    class="canvasContainer"
    style={`${style ?? ""} ${size ? `width: ${size.width}px; height: ${size.height}px;` : ""}`}
>
    <canvas bind:this={staticCanvas} class="staticCanvas" width="{size?.width }px" height="{size?.height}"></canvas>
    <canvas bind:this={dynamicCanvas} class="dynamicCanvas" width="{size?.width }px" height="{size?.height}"></canvas>
    <div class="cursorContainer">
        {#if canvasController}
            {#each Object.values(canvasController.othersCursors) as cursor, _ (cursor.id)}
          
                <UserCursor {...cursor} />
            {/each}
        {/if}
        {#if canvasController?.selfCursor}

            <UserCursor {...canvasController.selfCursor} instant />
        {/if}
    </div>
</div>

<style>
    .canvasContainer {
        position: relative;
        border: 2px solid red;
        cursor: none;
        overflow: hidden;
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

    .cursorContainer {
        pointer-events: none;
    }




</style>
