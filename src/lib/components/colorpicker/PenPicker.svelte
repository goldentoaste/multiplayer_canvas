<script lang="ts" module>
    export interface PenData {
        colors: string[];
        selectedColor: string;
        sizes: number[]; // in px
        selectedSize: number;
        layer: number;
        name: string;
        smooth: boolean;
        icon: string;
    }
</script>

<script lang="ts">
    import ColorPicker from "./ColorPicker.svelte";
    import Picker, { type PickerProp } from "../picker/Picker.svelte";
    import { fly } from "svelte/transition";

    interface Props {
        pens: PenData[];
        selectedPen?: string | undefined;
        style?: string;
    }

    let { pens, selectedPen = $bindable(undefined), style }: Props = $props();

    let penSizes: PickerProp<number>["items"] = $derived.by(() => {
        if (!selectedPen) {
            return [];
        }

        for (const pen of pens) {
            if (pen.name === selectedPen) {
                return pen.sizes.map((s) => ({
                    data: s,
                    name: `${s}`,
                })) as PickerProp<number>["items"];
            }
        }

        return [];
    });
</script>

{#snippet PenSizeDot(size: number)}
    <div
        class="dot"
        style="--size:{0.4 +
            (penSizes.findIndex((item) => item.data == size) / penSizes.length) * 0.6}"
    ></div>
{/snippet}

<div class="pensContainer" {style}>
    
    {#each pens as pen (pen.name)}

        <div class="penHolder">
            <button
                class="pen circle"
                style="border-color: {selectedPen === pen.name ? "red":"black"};"
                onclick={() => {
                    if (selectedPen === pen.name) {
                        selectedPen = undefined;
                    } else {
                        selectedPen = pen.name;
                    }
                }}
            >
                <img src={pen.icon} alt={pen.name} /></button
            >

            {#if selectedPen && selectedPen === pen.name}
                <div class="panel" transition:fly={{ x: -20 }}>
                    <ColorPicker colors={pen.colors} bind:selectedColor={pen.selectedColor} />
                    <Picker
                        items={penSizes}
                        snippet={PenSizeDot}
                        bind:selectedItem={
                            () => {
                                return {
                                    name: `${pen.selectedSize}`,
                                    data: pen.selectedSize,
                                };
                            },
                            (d) => {
                                pen.selectedSize = d.data;
                            }
                        }
                    />
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .dot {
        width: 1rem;
        height: 1rem;

        border: none;
        background-color: transparent;
        position: relative;
    }

    .dot::after {
        content: "";
        position: absolute;
        width: calc(var(--size) * 1rem);
        height: calc(var(--size) * 1rem);

        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: black;
        border-radius: 50%;
    }

    .penHolder {
        position: relative;
    }

    .pensContainer {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        position: relative;

        width: fit-content;
    }

    .circle {
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        position: relative;

        justify-content: center;
        align-items: center;
        border-radius: 50%;

        padding: 0.2rem;
    }

    .pen {
        border: 2px solid black;
        background-color: white;
    }

    .panel {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        border-radius: 5px;
        border: 2px solid grey;

        background-color: white;

        position: absolute;
        left: calc(100% + 1rem);
        top: 0;
    }
</style>
