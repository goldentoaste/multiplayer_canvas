<script lang="ts">
    import { onMount } from "svelte";
    import ColorPicker from "../colorpicker/ColorPicker.svelte";

    interface Props {
        username: string;
        color: string;
    }

    let { username = $bindable(""), color = $bindable("black") }: Props = $props();

    onMount(() => {
        if (localStorage.getItem("username") !== null) {
            username = localStorage.getItem("username") ?? "";
        }

        if (localStorage.getItem("usercolor") !== null) {
            color = localStorage.getItem("usercolor") ?? "black";
        }
    });

    $effect(() => {
        if (username && username.length > 0) {
            localStorage.setItem("username", username);
        }
    });

    $effect(() => {
        if (color && color.length > 0) {
            localStorage.setItem("usercolor", color);
        }
    });
</script>

<div>
    <div>Username: <input type="text" bind:value={username} /></div>
    <div
        >User color: <ColorPicker
            colors={["#9de19a", "#a4c5ea", "#bca9e1", "#e7eca3", "#98a7f2"]}
            bind:selectedColor={color}
        /></div
    >
</div>

<style>
    /* CSS */
</style>
