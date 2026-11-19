<!-- @component Magic link sign-in. -->
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
  import MagicLinkForm from './MagicLinkForm.svelte';

  const destination = $derived(
    signInDestination(page.url.searchParams.get('next') ?? undefined),
  );
  const query = $derived(
    signInQuery(
      destination,
      signInIntent(page.url.searchParams.get('intent') ?? undefined),
    ),
  );
</script>

<div class="mx-auto max-w-sm">
  <Card>
    <CardHeader>
      <CardTitle>Magic link</CardTitle>
      <CardDescription>
        Enter your email and we will send you a link that signs you in.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <MagicLinkForm next={destination} />
      <OtherWaysLink {query} />
    </CardContent>
  </Card>
</div>
