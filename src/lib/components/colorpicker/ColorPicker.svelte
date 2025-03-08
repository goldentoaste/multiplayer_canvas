<script lang="ts">
    interface Props {
        colors: string[];
        selectedColor: string;
    }

    let { colors, selectedColor = $bindable("black") }: Props = $props();
</script>

<div class="colorContainer">
    {#each colors as color}
        <button
            class="colorItem"
            style="--color:{color}"
            class:selected={selectedColor === color}
            onclick={() => {
                if (selectedColor === color) {
                    selectedColor = "black";
                } else {
                    selectedColor = color;
                }
            }}
        ></button>
    {/each}
</div>

<style>
    .colorContainer {
        display: flex;
        flex-direction: row;

        gap: 0.5rem;
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
</style>
