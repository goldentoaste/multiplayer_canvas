

<script lang="ts">
  import { onMount } from "svelte";

    


    let username = $state("");

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
<style>
    
</style>