<!--
  @component
  What a path without a page shows, as Next's default not-found page, and any
  other error the same way.
-->
<script lang="ts">
  import CenteredLayout from '#lib/components/CenteredLayout.svelte';
  import { page } from '$app/state';
</script>

<CenteredLayout>
  <div class="flex items-center justify-center gap-4">
    <h1 class="border-r pr-4 font-medium text-2xl">{page.status}</h1>
    <p class="text-sm">
      {page.status === 404
        ? 'This page could not be found.'
        : page.error?.message}
    </p>
  </div>
</CenteredLayout>
