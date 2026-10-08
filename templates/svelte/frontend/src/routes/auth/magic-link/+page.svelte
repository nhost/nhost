<script lang="ts">
import * as Card from '$lib/components/ui/card';
import { localMailboxURL } from '$lib/nhost/env';
import { nextDestination } from '$lib/signin/next';
import MagicLinkForm from './MagicLinkForm.svelte';

/**
 * Magic link sign-in. The page only sends the email: the link in it goes to
 * the auth service, which signs the visitor in and redirects back to `next`
 * with a refresh token `lib/nhost/linkToken.ts` redeems on arrival.
 */
const next = $derived(nextDestination());
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
      <a
        href="/signin"
        class="text-muted-foreground text-sm underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Other ways to sign in
      </a>
    </Card.Content>
  </Card.Root>
</div>
