<script lang="ts">
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '#lib/components/ui/card/index.ts';
  import { signInDestination } from '#routes/signin/destination.ts';
  import { signInIntent } from '#routes/signin/intent.ts';
  import OtherWaysLink from '#routes/signin/OtherWaysLink.svelte';
  import { signInQuery } from '#routes/signin/query.ts';
  import { page } from '$app/state';
  import PasswordForm from './PasswordForm.svelte';

  const destination = $derived(
    signInDestination(page.url.searchParams.get('next') ?? undefined),
  );
  const chosen = $derived(
    signInIntent(page.url.searchParams.get('intent') ?? undefined),
  );
  const query = $derived(signInQuery(destination, chosen));
</script>

<div class="mx-auto max-w-sm">
  <Card>
    <CardHeader>
      <CardTitle>Email and password</CardTitle>
      <CardDescription>
        Sign in, or sign up and confirm your address by email.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <PasswordForm next={destination} intent={chosen} />
      <OtherWaysLink {query} />
    </CardContent>
  </Card>
</div>
