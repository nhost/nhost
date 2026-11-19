<script lang="ts">
  import CenteredLayout from '#lib/components/CenteredLayout.svelte';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<CenteredLayout>{@render children()}</CenteredLayout>
