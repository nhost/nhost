<script lang="ts">
import * as Card from '$lib/components/ui/card';
import { localMailboxURL } from '$lib/nhost/env';
import { pageIntent } from '$lib/signin/intentFrom';
import { nextDestination } from '$lib/signin/next';
import OtherWaysLink from '$lib/signin/OtherWaysLink.svelte';
import { signInQuery } from '$lib/signin/query';
import MagicLinkForm from './MagicLinkForm.svelte';

/**
 * Magic link sign-in. The page only sends the email: the link in it goes to
 * the auth service, which signs the visitor in and redirects back to `next`
 * with a refresh token `lib/nhost/linkToken.ts` redeems on arrival.
 */
const next = $derived(nextDestination());
const intent = $derived(pageIntent());
const query = $derived(signInQuery(next, intent));
const mailboxUrl = localMailboxURL();
</script>

<div class="mx-auto max-w-md">
  <Card.Root>
    <Card.Header>
      <Card.Title>Magic link</Card.Title>
      <Card.Description>
        Enter your email and we will send you a link that signs you in.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <MagicLinkForm {next} {mailboxUrl} />
      <OtherWaysLink {query} />
    </Card.Content>
  </Card.Root>
</div>
