<!-- @component Lists the ways to sign in. -->
<script lang="ts" module>
  import type { Intent } from './intent.ts';

  // What the page says depends on why the visitor is here.
  const copy: Record<
    Intent,
    {
      title: string;
      description: string;
      switchTo: { intent: Intent; prompt: string; label: string };
    }
  > = {
    'sign-up': {
      title: 'Create an account',
      description: 'Choose how you want to sign up.',
      switchTo: {
        intent: 'sign-in',
        prompt: 'Already have an account?',
        label: 'Sign in',
      },
    },
    'sign-in': {
      title: 'Sign in',
      description: 'Choose how you want to sign in.',
      switchTo: {
        intent: 'sign-up',
        prompt: 'New here?',
        label: 'Create an account',
      },
    },
  };
</script>

<script lang="ts">
  import LastUsedBadge from '#lib/components/LastUsedBadge.svelte';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '#lib/components/ui/card/index.ts';
  import { page } from '$app/state';
  import type { PageProps } from './$types';
  import { signInDestination } from './destination.ts';
  import { signInIntent } from './intent.ts';
  import { buttons, methods } from './methods.ts';
  import { signInQuery } from './query.ts';

  let { data }: PageProps = $props();

  const destination = $derived(
    signInDestination(page.url.searchParams.get('next') ?? undefined),
  );
  const chosen = $derived(
    signInIntent(page.url.searchParams.get('intent') ?? undefined),
  );
  const query = $derived(signInQuery(destination, chosen));
  const switchTo = $derived(copy[chosen].switchTo);
</script>

<div class="mx-auto max-w-sm">
  <Card>
    <!-- Everything is centred, the links included, to match the provider
         buttons, which centre their own label. -->
    <CardHeader class="text-center">
      <CardTitle>{copy[chosen].title}</CardTitle>
      <CardDescription>{copy[chosen].description}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3 px-10">
      {#each methods as method (method.href)}
        <a
          href={`${method.href}${query}`}
          class="relative rounded-md border px-4 py-2 text-center outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#if method.href === data.lastUsed}
            <LastUsedBadge />
          {/if}
          <div class="font-medium text-sm">{method.title}</div>
          <div class="text-muted-foreground text-xs">
            {method.description}
          </div>
        </a>
      {/each}
      {#if buttons.length > 0}
        <!-- Set apart from the links: these leave for the provider straight
             away, where a link opens a page of the app's. -->
        {#if methods.length > 0}
          <div
            class="flex items-center gap-3 py-2 text-muted-foreground text-xs"
          >
            <span class="h-px flex-1 bg-border"></span>
            or
            <span class="h-px flex-1 bg-border"></span>
          </div>
        {/if}
        {#each buttons as Buttons, index (index)}
          <Buttons {destination} lastUsed={data.lastUsed} />
        {/each}
      {/if}
      <!-- A clear gap, not a nudge: this is the way out of the list, not
           another item in it. -->
      <p class="pt-6 text-center text-muted-foreground text-sm">
        {switchTo.prompt}
        <a
          href={`/signin${signInQuery(destination, switchTo.intent)}`}
          class="text-foreground underline-offset-4 hover:underline"
        >
          {switchTo.label}
        </a>
      </p>
    </CardContent>
  </Card>
</div>
