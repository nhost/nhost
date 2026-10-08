<script lang="ts">
import * as Card from '$lib/components/ui/card';
import { localMailboxURL } from '$lib/nhost/env';
import { nextDestination } from '$lib/signin/next';
import OtpForm from './OtpForm.svelte';

const next = $derived(nextDestination());
const mailboxUrl = localMailboxURL();
</script>

<div class="mx-auto max-w-md">
  <Card.Root>
    <Card.Header>
      <Card.Title>Email code</Card.Title>
      <Card.Description>
        We email you a one-time code and you type it in here.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <OtpForm {next} {mailboxUrl} />
      <a
        href="/signin"
        class="text-muted-foreground text-sm underline underline-offset-4"
      >
        Other ways to sign in
      </a>
    </Card.Content>
  </Card.Root>
</div>
