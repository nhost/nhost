<script lang="ts">
  import ReplacePageLayout from '#lib/components/ReplacePageLayout.svelte';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<ReplacePageLayout>{@render children()}</ReplacePageLayout>
