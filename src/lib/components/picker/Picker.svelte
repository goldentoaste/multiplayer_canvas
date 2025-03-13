<script lang="ts" generics="T">
    export interface PickerProp<T> {
        items: {
            name: string; // also used as backup display, must be unique
            data: T; // internal representation
            icon?: string; // path to icon}
        }[];
        selectedItem?: string; // internal rep of the currently selected item
    }

    let { items, selectedItem = $bindable("") }: PickerProp<T> = $props();
</script>

<div class="pickerContainer">
    {#each items as item (item.name)}
        <button
            class="pickerItem"
            class:selected={item.name == selectedItem}
            onclick={() => {
                if (selectedItem == item.name) {
                    selectedItem = ""; // empty as default value
                } else {
                    selectedItem = item.name;
                }
            }}
            title={item.name}
        >
            {#if item.icon}
                <img src={item.icon} alt={item.name} />
            {:else}
                <span>{item.name}</span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .pickerContainer {
        display: flex;
        flex-direction: row;
        gap: 0.5rem;
    }

    .pickerItem {
        /* place holder */
        margin: 0.25rem;
    }

    .pickerItem.selected {
        border: 1px solid red;
    }
</style>
