<!-- @component Shows `AuthErrorNotice` for the current URL, on any page. -->
<script lang="ts">
  import AuthErrorNotice from '#lib/components/AuthErrorNotice.svelte';
  import { page } from '$app/state';

  const error = $derived(page.url.searchParams.get('error'));
</script>

{#if error}
  <div class="mx-auto mb-4 max-w-sm">
    <AuthErrorNotice {error} />
  </div>
{/if}
