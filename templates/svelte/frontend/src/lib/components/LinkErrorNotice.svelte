<script lang="ts">
import { afterNavigate } from '$app/navigation';
import { useAuth } from '$lib/nhost/auth.svelte';

/**
 * Says why the link or provider redirect the visitor arrived from did not
 * sign them in. It sits above every page because that can be any of them: an
 * auth email or a provider comes back to wherever `next` said.
 *
 * It goes once the visitor moves on, except to sign-in: that is where trying
 * again starts, and where a protected page sends someone the link did not
 * sign in, so the reason still applies there. The `enter` navigation is the
 * app starting on the page they arrived on, not them leaving it.
 */
const auth = useAuth();

afterNavigate(({ type, from, to }) => {
  const path = to?.url.pathname;

  if (type !== 'enter' && path !== from?.url.pathname && path !== '/signin') {
    auth.clearLinkError();
  }
});
</script>

{#if auth.linkError}
  <p role="alert" class="mx-auto mb-6 max-w-md text-destructive text-sm">
    {auth.linkError}
  </p>
{/if}
