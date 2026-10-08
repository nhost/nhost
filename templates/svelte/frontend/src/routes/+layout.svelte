<script lang="ts">
import '../app.css';
import LinkErrorNotice from '$lib/components/LinkErrorNotice.svelte';
import Nav from '$lib/components/Nav.svelte';

let { children } = $props();
</script>

<Nav />
<main class="mx-auto max-w-4xl px-6 py-10">
  <LinkErrorNotice />
  {@render children?.()}
</main>
