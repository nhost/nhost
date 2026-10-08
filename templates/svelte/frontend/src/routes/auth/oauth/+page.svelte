<script lang="ts">
import * as Card from '$lib/components/ui/card';
import { useAuth } from '$lib/nhost/auth.svelte';
import { appOrigin } from '$lib/nhost/env';
import { pageIntent } from '$lib/signin/intentFrom';
import { nextDestination } from '$lib/signin/next';
import OtherWaysLink from '$lib/signin/OtherWaysLink.svelte';
import { signInQuery } from '$lib/signin/query';
import OAuthButtons from './OAuthButtons.svelte';
import { providers } from './providers';

/**
 * Sign in with a provider account.
 *
 * This is a redirect, not a request: each button sends the browser to the
 * auth service, which does the provider round-trip and comes back to
 * `redirectTo` with a refresh token on the URL. That token is redeemed by
 * `lib/nhost/linkToken.ts` when the app loads again, so this page never sees
 * the callback.
 */
const auth = useAuth();
const next = $derived(nextDestination());
const intent = $derived(pageIntent());
const query = $derived(signInQuery(next, intent));

const links = $derived(
  providers.map(({ id, label }) => ({
    id,
    label,
    href: auth.nhost.auth.signInProviderURL(id, {
      redirectTo: appOrigin() + next,
    }),
  })),
);
</script>

<div class="mx-auto max-w-md">
  <Card.Root>
    <Card.Header>
      <Card.Title>GitHub or Google</Card.Title>
      <Card.Description>Sign in with a provider account.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <OAuthButtons {links} />
      <p class="text-muted-foreground text-sm">
        A provider only works once it is enabled in <code>nhost.toml</code>. The
        README's OAuth section has the callback URL and the config.
      </p>
      <OtherWaysLink {query} />
    </Card.Content>
  </Card.Root>
</div>
