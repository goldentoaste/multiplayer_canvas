<script lang="ts">
    import { CanvasController, type UserData } from "./CanvasController.svelte";
    import UserCursor from "../Cursor/UserCursor.svelte";
    import { onDestroy } from "svelte";

    interface CanvasProps {
        size?: { width: number; height: number };
        style?: string;
        userdata?: UserData;
        maxLayers: number; // the highest layer that the pen options can provide
    }

    let { size, style, userdata, maxLayers }: CanvasProps = $props();

    let staticCanvas: HTMLCanvasElement | undefined = $state();
    let dynamicCanvas: HTMLCanvasElement | undefined = $state();

    let canvasController = $derived.by(() => {
        if (staticCanvas && dynamicCanvas && maxLayers > 0) {
            return new CanvasController(staticCanvas, dynamicCanvas, maxLayers);
        }
        return undefined;
    });

    $effect(() => {
        if (canvasController && userdata) {
            canvasController.userdata = userdata;
        }
    });

    onDestroy(() => {
        if (canvasController) {
            // canvasController.cleanup();
        }
    });
</script>

<span>Delete mode: {canvasController?.deleteMode}</span>
<button
    onclick={() => {
        canvasController && (canvasController.deleteMode = !canvasController.deleteMode);
    }}>toggle delete</button
>
<div
    class="canvasContainer"
    style={`${style ?? ""} ${size ? `width: ${size.width}px; height: ${size.height}px;` : ""}`}
>
    <canvas
        bind:this={staticCanvas}
        class="staticCanvas"
        width="{size?.width}px"
        height={size?.height}
    ></canvas>
    <canvas
        bind:this={dynamicCanvas}
        class="dynamicCanvas"
        width="{size?.width}px"
        height={size?.height}
    ></canvas>
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
        /* margin-left: 1000px;
        margin-top: 1000px; */
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
