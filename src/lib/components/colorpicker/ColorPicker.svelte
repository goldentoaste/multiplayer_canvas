<script lang="ts">
    interface Props {
        colors: string[];
        selectedColor: string;
        allowDeselect?: boolean;
        allowCustom?: boolean;
    }

    let {
        colors,
        selectedColor = $bindable("black"),
        allowDeselect = false,
        allowCustom = false,
    }: Props = $props();
</script>

<div class="colorContainer">
    {#each colors as color}
        <button
            class="colorItem"
            class:selected={selectedColor === color}
            style="--color:{color}"
            onclick={(e) => {
              
                if (selectedColor === color) {
                    if (!allowDeselect) {
                        return;
                    }
                    selectedColor = "black";
                } else {
                    selectedColor = color;
                 
                }
            }}
        ></button>
    {/each}
    {#if allowCustom}
        <span
            >Custom color:
            <input
                type="color"
                onchange={(e) => {
                    selectedColor = (e.target as HTMLInputElement).value;
                }}
            /></span
        >
    {/if}
</div>

<style>
    .colorContainer {
        display: flex;
        flex-direction: row;

        gap: 0.5rem;
        align-items: center;
        width: fit-content;
        margin: 0.5rem;
    }

    .colorItem {
        position: relative;
        border-radius: 50%;

        display: block;
        width: 1rem;
        height: 1rem;

        border: none;

        background-color: var(--color);
    }

    .selected::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;

        width: calc(100% + 2px);
        height: calc(100% + 2px);

        background-color: transparent;
        border: 2px solid var(--color);
        border-radius: 50%;

        transform: translate(-50%, -50%);
    }

    span {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
</style>
