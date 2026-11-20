<!--
  @component
  A button for each provider the deployment set up, shown on the sign-in list
  itself.
-->
<script lang="ts">
  import { DEFAULT_INTENT } from '#routes/signin/intent.ts';
  import { signInQuery } from '#routes/signin/query.ts';
  import OAuthButtons from './OAuthButtons.svelte';
  import { configuredProviders, providerHref } from './providers.ts';

  let {
    destination,
    lastUsed,
  }: { destination: string; lastUsed: string | null } = $props();

  const links = $derived(
    configuredProviders().map(({ id, label }) => ({
      id,
      label,
      href: `${providerHref(id)}${signInQuery(destination, DEFAULT_INTENT)}`,
      lastUsed: providerHref(id) === lastUsed,
    })),
  );
</script>

<OAuthButtons {links} />
