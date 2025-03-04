<script lang="ts">
    interface CanvasProps {
        size?: { width: number; height: number };
        style?: string;
    }

    let { size, style }: CanvasProps = $props();
</script>

<div
    class="canvasContainer"
    style={`${style ?? ""} ${size ? `width: ${size.width}px; height: ${size.height}px;` : ""}`}
>
    <canvas class="staticCanvas"></canvas>
    <canvas class="dynamicCanvas"></canvas>
    <div class="cursorContainer"></div>
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
        position: relative;
    }
</style>
