

<script lang="ts">
    import MultiplayerCanvas from "$lib/components/canvas/MultiplayerCanvas.svelte";
    import { onMount } from "svelte";

    


    let username = $state("abc");

    $effect(()=>{
        if(username && username.length > 0){
            localStorage.setItem("name", username);
        }
    })

    onMount(()=>{
        if(localStorage.getItem("name")){
            username = localStorage.getItem("name")!;
        }
    })


</script>

<h1>Canvas!</h1>
<label for="name">Enter your name to continue: <input id="name" type="text" bind:value="{username}"/></label>


<MultiplayerCanvas size={{width:800, height:600}} {username}/>

<style>
    
</style>