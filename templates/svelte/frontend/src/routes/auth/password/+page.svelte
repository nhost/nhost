<script lang="ts">
import * as Card from '$lib/components/ui/card';
import { localMailboxURL } from '$lib/nhost/env';
import { pageIntent } from '$lib/signin/intentFrom';
import { nextDestination } from '$lib/signin/next';
import OtherWaysLink from '$lib/signin/OtherWaysLink.svelte';
import { signInQuery } from '$lib/signin/query';
import PasswordForm from './PasswordForm.svelte';

const next = $derived(nextDestination());
const intent = $derived(pageIntent());
const query = $derived(signInQuery(next, intent));
const mailboxUrl = localMailboxURL();
</script>

<div class="mx-auto max-w-md">
  <Card.Root>
    <Card.Header>
      <Card.Title>Email and password</Card.Title>
      <Card.Description>
        Sign in, or sign up and confirm your address by email.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <PasswordForm {next} {intent} {mailboxUrl} />
      <OtherWaysLink {query} />
    </Card.Content>
  </Card.Root>
</div>
