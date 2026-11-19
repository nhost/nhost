<!-- @component One button per provider. -->
<script lang="ts" module>
  export type OAuthLink = {
    id: string;
    label: string;
    href: string;
    lastUsed?: boolean;
  };
</script>

<script lang="ts">
  import LastUsedBadge from '#lib/components/LastUsedBadge.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import ProviderIcon from './ProviderIcon.svelte';

  let { links }: { links: OAuthLink[] } = $props();
</script>

<div class="flex flex-col gap-3">
  {#each links as link (link.id)}
    <!-- A full page load, not a client-side navigation: the route it opens
         sends the browser on to the provider, on another origin. The button
         sizes and spaces the mark itself: its own rules give any svg inside it
         size-4 and a gap from the text. -->
    <Button
      href={link.href}
      data-sveltekit-reload
      variant="outline"
      class="relative w-full bg-transparent shadow-none dark:border-border dark:bg-transparent dark:hover:bg-accent"
    >
      <ProviderIcon id={link.id} />
      {link.label}
      {#if link.lastUsed}
        <LastUsedBadge />
      {/if}
    </Button>
  {/each}
</div>
