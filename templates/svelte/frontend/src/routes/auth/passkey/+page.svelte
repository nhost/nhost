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
  import PasskeyForm from './PasskeyForm.svelte';

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
      <CardTitle>Passkey</CardTitle>
      <CardDescription>
        Touch ID, Windows Hello, or a security key. Nothing to remember.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <PasskeyForm next={destination} intent={chosen} />
      <OtherWaysLink {query} />
    </CardContent>
  </Card>
</div>
