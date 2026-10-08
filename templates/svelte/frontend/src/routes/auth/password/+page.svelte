<script lang="ts">
import * as Card from '$lib/components/ui/card';
import { nextDestination } from '$lib/signin/next';
import PasswordForm from './PasswordForm.svelte';

const next = $derived(nextDestination());
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
      <PasswordForm {next} />
      <a
        href="/signin"
        class="text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        Other ways to sign in
      </a>
    </Card.Content>
  </Card.Root>
</div>
