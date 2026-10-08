<script lang="ts">
import { goto } from '$app/navigation';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { useAuth } from '$lib/nhost/auth.svelte';
import { requestPasswordReset, signIn, signUp } from './actions';

let { next }: { next: string } = $props();

type Mode = 'sign-in' | 'sign-up';

// What the form shows once a request has gone out and there is nothing more
// to type: the next step happens in the visitor's inbox.
type Sent = 'verification' | 'reset';

const auth = useAuth();

// One id per component instance, suffixed per field: `$props.id()` is a
// unique prefix and may only be called once.
const uid = $props.id();
const emailId = `${uid}-email`;
const passwordId = `${uid}-password`;

let mode = $state<Mode>('sign-in');
let email = $state('');
let password = $state('');
let sent = $state<Sent | undefined>();
let error = $state<string | undefined>();
let isPending = $state(false);

function switchMode(): void {
  mode = mode === 'sign-in' ? 'sign-up' : 'sign-in';
  error = undefined;
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  error = undefined;
  isPending = true;
  try {
    if (mode === 'sign-in') {
      const result = await signIn(auth.nhost, email, password);
      if (result.error) {
        error = result.error;
        return;
      }

      await goto(next);
      return;
    }

    const result = await signUp(auth.nhost, email, password, next);
    if (result.error) {
      error = result.error;
      return;
    }

    if (result.signedIn) {
      await goto(next);
      return;
    }

    sent = 'verification';
  } catch (err) {
    console.error('Error submitting the form:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    isPending = false;
  }
}

async function handleForgotPassword(): Promise<void> {
  error = undefined;
  isPending = true;
  try {
    const result = await requestPasswordReset(auth.nhost, email);
    if (result.error) {
      error = result.error;
      return;
    }

    sent = 'reset';
  } catch (err) {
    console.error('Error requesting the reset link:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    isPending = false;
  }
}
</script>

{#if sent === 'verification'}
  <div class="flex flex-col gap-2 text-sm">
    <p class="font-medium">Check your inbox</p>
    <p class="text-muted-foreground">
      We sent a verification link to {email}. Opening it confirms the address
      and signs you in.
    </p>
  </div>
{:else if sent === 'reset'}
  <div class="flex flex-col gap-2 text-sm">
    <p class="font-medium">Check your inbox</p>
    <p class="text-muted-foreground">
      If that address has an account, a reset link is on its way.
    </p>
  </div>
{:else}
  <form class="flex flex-col gap-4" onsubmit={handleSubmit}>
    <div class="flex flex-col gap-2">
      <Label for={emailId}>Email</Label>
      <Input
        id={emailId}
        type="email"
        autocomplete="email"
        required
        bind:value={email}
        disabled={isPending}
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label for={passwordId}>Password</Label>
      <Input
        id={passwordId}
        type="password"
        autocomplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        required
        bind:value={password}
        disabled={isPending}
      />
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <Button type="submit" disabled={isPending}>
      {#if mode === 'sign-in'}
        {isPending ? 'Signing in…' : 'Sign in'}
      {:else}
        {isPending ? 'Signing up…' : 'Sign up'}
      {/if}
    </Button>

    <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
      <Button
        type="button"
        variant="link"
        size="sm"
        class="h-auto p-0"
        disabled={isPending}
        onclick={switchMode}
      >
        {mode === 'sign-in'
          ? 'Create an account'
          : 'I already have an account'}
      </Button>
      {#if mode === 'sign-in'}
        <Button
          type="button"
          variant="link"
          size="sm"
          class="h-auto p-0"
          disabled={isPending || !email}
          onclick={handleForgotPassword}
        >
          Forgot your password?
        </Button>
      {/if}
    </div>
  </form>
{/if}
