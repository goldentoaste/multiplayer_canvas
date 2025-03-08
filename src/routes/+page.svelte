<script lang="ts">
    import type { UserData } from "$lib/components/canvas/CanvasController.svelte";
    import MultiplayerCanvas from "$lib/components/canvas/MultiplayerCanvas.svelte";
    import ColorPicker from "$lib/components/colorpicker/ColorPicker.svelte";
    import { onMount } from "svelte";

    let userdata: UserData = $state({
        username: "",
        color: "black",
        penColor: "black",
        penThickness: 4,
    });

    $effect(() => {
        if (userdata) {
            localStorage.setItem("user", JSON.stringify(userdata));
        }
    });

    onMount(() => {
        if (localStorage.getItem("user")) {
            userdata = JSON.parse(localStorage.getItem("user") ?? "{}") as UserData;
        }
    });
</script>

<h1>Canvas!</h1>

<div class="contaienr">
    <label for="name"
        >Enter your name to continue: <input
            id="name"
            type="text"
            bind:value={userdata.username}
        /></label
    >
    <label for=""
        >User color: <ColorPicker
            colors={["#3730A3", "#166434", "#9A3412", "#B91C1B"]}
            bind:selectedColor={userdata.color}
        />
    </label>

    <label
        >Pen thickness: <input
            type="number"
            defaultValue="4"
            bind:value={userdata.penThickness}
        /></label
    >
    <label for=""
        >Pen color: <ColorPicker
            colors={["#3730A3", "#166434", "#9A3412", "#B91C1B"]}
            bind:selectedColor={userdata.penColor}
        />
    </label>
</div>

<MultiplayerCanvas size={{ width: 1200, height: 800 }} {userdata} />

<style>
    .contaienr {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
</style>
