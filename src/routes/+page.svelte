<script lang="ts">
    import type { UserData } from "$lib/components/canvas/CanvasController.svelte";
    import MultiplayerCanvas from "$lib/components/canvas/MultiplayerCanvas.svelte";
    import ColorPicker from "$lib/components/colorpicker/ColorPicker.svelte";
    import type { PenData } from "$lib/components/colorpicker/PenPicker.svelte";
    import PenPicker from "$lib/components/colorpicker/PenPicker.svelte";
    import UserInfo from "$lib/components/userInfo/UserInfo.svelte";
    import { onMount } from "svelte";

    let username = $state("");
    let usercolor = $state("");

    let selectedPen = $state("Pen");

    let pendata: { [id: string]: PenData } = $state({
        Pen: {
            name: "Pen",
            icon: "/pen.svg",
            colors: ["#241e27"],
            selectedColor: "#241e27",
            layer: 1,
            smooth: true,
            sizes: [2, 4, 8, 12],
            selectedSize: 4,
        },
        Brush: {
            name: "Brush",
            icon: "/brush.svg",
            layer: 0,
            colors: ["#FFC956", "#5656FF", "#FF5686", "#3BE8A3", "#CF56FF"],
            selectedColor: "#FFC956",
            selectedSize: 40,
            sizes: [20, 40, 60],
            smooth: false,
        },
    });

    let userdata: UserData = $derived({
        username,
        color: usercolor,
        penInfo: {
            name: pendata[selectedPen]?.name,
            layer: pendata[selectedPen]?.layer,
            penColor: pendata[selectedPen]?.selectedColor,
            penThickness: pendata[selectedPen]?.selectedSize,
            smoothing: pendata[selectedPen]?.smooth,
        },
    });
</script>

<h1>Canvas!</h1>

<div class="container">
    <UserInfo bind:username bind:color={usercolor} />
    <PenPicker pens={Object.values(pendata)} bind:selectedPen />
    <MultiplayerCanvas size={{ width: 1200, height: 800 }} {userdata} maxLayers={2} />
</div>

<p>Some instructions</p>
<ul>
    <li>Choose your *username*, *cursor color*, *pen thickness* and *pen color*</li>

    <li>Click and drag to draw</li>
    <li>!! Middle mouse to PAN</li>

    <li>Mobile: 1 finger to draw</li>
    <li>Mobile 2 fingers to *pan*!</li>
</ul>

<style>
    .container {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
</style>
