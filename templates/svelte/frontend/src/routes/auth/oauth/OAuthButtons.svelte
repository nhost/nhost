<script lang="ts" module>
export type OAuthLink = {
  id: string;
  label: string;
  href: string;
};
</script>

<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  /**
   * One button per provider. The href is the auth service, another origin, and
   * the whole point is to leave this app for it, so these are ordinary links
   * rather than anything the router handles.
   */
  let { links }: { links: OAuthLink[] } = $props();
</script>

<div class="flex flex-col gap-2">
  {#each links as link (link.id)}
    <Button href={link.href} variant="outline" class="w-full">
      {link.label}
    </Button>
  {/each}
</div>
