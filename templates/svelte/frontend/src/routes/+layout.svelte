<script lang="ts">
  import '../app.css';
  import favicon from '#lib/assets/favicon.svg';
  import AuthErrorFromUrl from '#lib/components/AuthErrorFromUrl.svelte';
  import Footer from '#lib/components/Footer.svelte';
  import Nav from '#lib/components/Nav.svelte';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <title>Nhost + Svelte</title>
  <meta
    name="description"
    content="An auth starter powered by Nhost and Svelte"
  />
  <link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>

<Nav />
<main class="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
  <AuthErrorFromUrl />
  {@render children()}
</main>
<Footer />
