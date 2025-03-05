<script lang="ts">
    import { Tester } from "./SanityTest1.svelte";

    let toggle = $state(false);
    let tester = $derived.by(() => {
        if (toggle) {
            return new Tester();
        }
        return undefined;
    });
</script>

<button
    onclick={() => {
        toggle = !toggle;
   
        
    }}>toggle</button
>

{#if tester}
    <button
        onclick={() => {
            tester.addItem();
        }}>clikc</button
    >

    <p>
        {JSON.stringify(tester.stuff)}
    </p>
{/if}

<style>
    /* CSS */
</style>
