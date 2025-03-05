<script lang="ts">
    import type { Vector2 } from "$lib/Vector2";
    import { Spring } from "svelte/motion";
    import { fade } from "svelte/transition";

    interface CursorProps {
        id: string;
        username: string | undefined;
        color: string;
        pos: Vector2;
        instant?: boolean;
    }

    let { username, color, pos, instant = false }: CursorProps = $props();

    let smoothPos = new Spring(
        {
            x: pos.x,
            y:pos.y
        },
        instant? {stiffness:0.4, damping:0.9}:{
            stiffness: 0.1,
            damping: 0.65,
        },
    );

    $effect(()=>{ 
        smoothPos.target = {x:pos.x, y: pos.y}
    })


    

</script>


{#if username || true}
    <div
        class="cursor"
        style="--x:{smoothPos.current.x}px; --y:{smoothPos.current.y}px; --color:{color};"
        transition:fade={{ duration: 400 }}
    >
        {username}
    </div>
{/if}

<style>
    .cursor {
        position: absolute;
        left: var(--x);
        top: var(--y);

        padding: 0.25rem;
        color: white;
    }

    /* background of cursor */
    .cursor::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        /* pointy corner */
        border-radius: 8px;
        border-top-left-radius: 0;

        background-color: var(--color);
        opacity: 0.8;
        z-index: -1;
    }

    /* overlay to give text color effect, opacity add up with background to 100% */
    .cursor::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        border-radius: 8px;
        border-top-left-radius: 0;

        opacity: 0.2;
        background-color: var(--color);
    }
</style>
