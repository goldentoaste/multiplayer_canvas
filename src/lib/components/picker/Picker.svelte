<script lang="ts" generics="T">
    import type { Snippet } from "svelte";

    export interface PickerProp<T> {
        items: {
            name: string; // also used as backup display, must be unique
            data: T; // internal representation
            icon?: string; // path to icon}
        }[];
        selectedItem?: { name: string; data: T } | undefined; // internal rep of the currently selected item
        snippet?: Snippet<[T]>;
    }

    let { items, snippet, selectedItem = $bindable() }: PickerProp<T> = $props();
</script>

<div class="pickerContainer">
    {#each items as item (item.name)}
        <button
            class="pickerItem"
            class:selected={item.name == selectedItem?.name}
            onclick={() => {
                if (selectedItem?.name == item.name) {
                    selectedItem = undefined; // empty as default value
                } else {
                    selectedItem = {
                        data: item.data,
                        name: item.name,
                    };
                }
            }}
            title={item.name}
        >
            {#if item.icon}
                <img class="icon" src={item.icon} alt={item.name} />
            {:else if snippet}
                {@render snippet(item.data)}
            {:else}
                <span>{item.name}</span>
            {/if}
        </button>
    {/each}
</div>

<style>

    .icon {
        width: 1rem;
    }
    .pickerContainer {
        display: flex;
        flex-direction: row;
        gap: 0.5rem;
    }

    .pickerItem {
        /* place holder */
        margin: 0.25rem;
        background:none;
        border: none;
    }

    .pickerItem.selected {
        border: 1px solid red;
    }
</style>
