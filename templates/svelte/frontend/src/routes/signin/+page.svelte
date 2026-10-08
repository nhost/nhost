<script lang="ts">
import * as Card from '$lib/components/ui/card';
import type { Intent } from '$lib/signin/intent';
import { pageIntent } from '$lib/signin/intentFrom';
import { methods } from '$lib/signin/methods';
import { nextDestination } from '$lib/signin/next';
import { signInQuery } from '$lib/signin/query';

/**
 * Lists the ways to sign in. Each method is a page of its own under
 * `/auth/<method>`; this page only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the visitor was going when a protected page sent them here,
 * and `intent` is whether they came to sign up or to sign in. Both are passed
 * along to whichever method they pick: one so that page can finish the trip,
 * the other so a form opens on the right mode.
 */

// What the page says depends on why the visitor is here. Neither heading names
// a method, so both survive any selection.
const copy: Record<Intent, { title: string; description: string }> = {
  'sign-up': {
    title: 'Create an account',
    description: 'Choose how you want to sign up.',
  },
  'sign-in': {
    title: 'Sign in',
    description: 'Choose how you want to sign in.',
  },
};

const next = $derived(nextDestination());
const intent = $derived(pageIntent());

const query = $derived(signInQuery(next, intent));
</script>

<div class="mx-auto max-w-md">
  <Card.Root>
    <Card.Header>
      <Card.Title>{copy[intent].title}</Card.Title>
      <Card.Description>{copy[intent].description}</Card.Description>
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
