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
  import OtpForm from './OtpForm.svelte';

  const params = $derived(page.url.searchParams);
  // Opens the form on the code step for this address (see `link.ts`). It is
  // only ever shown, and "Use a different address" replaces it, so a crafted
  // one does nothing.
  const sentTo = $derived(params.get('email')?.trim() || undefined);
  const destination = $derived(
    signInDestination(params.get('next') ?? undefined),
  );
  const query = $derived(
    signInQuery(destination, signInIntent(params.get('intent') ?? undefined)),
  );
</script>

<div class="mx-auto max-w-sm">
  <Card>
    <CardHeader>
      <CardTitle>Email code</CardTitle>
      <CardDescription>
        We email you a one-time code and you type it in here.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <OtpForm next={destination} {sentTo} />
      <OtherWaysLink {query} />
    </CardContent>
  </Card>
</div>
