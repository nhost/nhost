<script lang="ts">
import '../app.css';
import Nav from '$lib/components/Nav.svelte';

let { children } = $props();
</script>

<Nav />
<main class="mx-auto max-w-4xl px-6 py-10">
  {@render children?.()}
</main>
