<!--
  The toasts sit outside the replaced page, so the one a form shows as it
  finishes is still there after the page under it renders again.
-->
<script lang="ts">
  import ReplacePageLayout from '#lib/components/ReplacePageLayout.svelte';
  import Toast from '#lib/components/Toast.svelte';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<Toast>
  <ReplacePageLayout>{@render children()}</ReplacePageLayout>
</Toast>
