<script lang="ts">
import * as Card from '$lib/components/ui/card';
import { DEFAULT_DESTINATION } from '$lib/signin/destination';
import { methods } from '$lib/signin/methods';
import { nextDestination } from '$lib/signin/next';

/**
 * Lists the ways to sign in. Each method is a page of its own under
 * `/auth/<method>`; this page only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the visitor was going when a protected page sent them
 * here. It is passed along to whichever method they pick, so that page can
 * finish the trip after signing them in.
 */
const next = $derived(nextDestination());

const query = $derived(
  next === DEFAULT_DESTINATION ? '' : `?next=${encodeURIComponent(next)}`,
);
</script>

<div class="mx-auto max-w-md">
  <Card.Root>
    <Card.Header>
      <Card.Title>Sign in</Card.Title>
      <Card.Description>Choose how you want to sign in.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-2">
      {#each methods as method (method.href)}
        <a
          href={`${method.href}${query}`}
          class="rounded-md border p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div class="font-medium">{method.title}</div>
          <div class="text-muted-foreground text-sm">{method.description}</div>
        </a>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
