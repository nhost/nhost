<!-- @component Two-factor, as a row on the account page. -->
<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';
  import DialogClose from '#lib/components/DialogClose.svelte';
  import DialogFooter from '#lib/components/DialogFooter.svelte';
  import DialogSetting from '#lib/components/DialogSetting.svelte';
  import { useToast } from '#lib/components/toast.svelte.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { cn } from '#lib/utils.ts';
  import { refreshAll } from '$app/navigation';
  import {
    disableMfa,
    enableMfa,
    generateMfa,
    type MfaSetup,
  } from './actions.remote.ts';

  let { user }: { user: User } = $props();

  // What a change here made it, until the page loaded again agrees: reopening
  // the dialog before then would otherwise offer the change just made.
  const reported = $derived(user.activeMfaType === 'totp');
  let changed = $state<{ from: boolean; to: boolean }>();
  const active = $derived(changed?.from === reported ? changed.to : reported);
  const toast = useToast();
  // The copied key's toast goes when the dialog does: it is about a key that
  // is no longer on screen.
  let dismissCopied: VoidFunction | undefined;
  const codeId = $props.id();

  let open = $state(false);
  // Which way the dialog was opened.
  let turningOff = $state(false);
  let setup = $state<MfaSetup>();
  let code = $state('');
  let error = $state<string>();
  let isPending = $state(false);

  $effect(() => {
    if (!open) {
      dismissCopied?.();
    }
  });

  const start = async (): Promise<void> => {
    isPending = true;
    try {
      const result = await generateMfa();
      if (result.error || !result.setup) {
        error = result.error ?? 'Could not start the setup.';
        return;
      }

      setup = result.setup;
    } catch (err) {
      console.error('Error starting the two-factor setup:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };

  const handleOpen = (): void => {
    code = '';
    error = undefined;
    turningOff = active;
    // A fresh secret on every opening. The backend stores it on the account
    // right away, and one shown earlier and closed is not worth keeping.
    if (!active) {
      setup = undefined;
      void start();
    }
  };

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;
    isPending = true;
    try {
      const result = turningOff
        ? await disableMfa(code)
        : await enableMfa(code);
      if (result.error) {
        error = result.error;
        return;
      }

      // The page reads the account's state from the auth service, so the row
      // changes when it loads again rather than being guessed at here.
      changed = { from: reported, to: !turningOff };
      open = false;
      code = '';
      toast(turningOff ? 'Two-factor is off' : 'Two-factor is on');
      await refreshAll();
    } catch (err) {
      console.error('Error changing two-factor:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };

  // Typing a key this long from the screen is where entering it by hand goes
  // wrong, so it can be pasted instead.
  const copyKey = async (key: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(key);
      dismissCopied = toast('Key copied');
    } catch (err) {
      console.error('Error copying the two-factor key:', err);
      toast('Could not copy the key');
    }
  };

  const ready = $derived(turningOff || setup !== undefined);
  const turning = $derived(turningOff ? 'off' : 'on');
</script>

{#snippet value()}
  <span class="inline-flex items-center gap-2">
    <span
      aria-hidden="true"
      class={cn(
        'size-1.5 rounded-full',
        active ? 'bg-success' : 'bg-muted-foreground/60',
      )}
    ></span>
    {active ? 'On' : 'Off'}
  </span>
{/snippet}

<DialogSetting
  label="Two-factor"
  {value}
  action={active ? 'Turn off' : 'Set up'}
  title={turningOff ? 'Turn off two-factor' : 'Set up two-factor'}
  description={turningOff
    ? 'Enter a current code from your authenticator app to turn it off.'
    : 'Asks for a code from an authenticator app when you sign in with your password. Other sign-in methods and emailed links skip it.'}
  bind:open
  onOpen={handleOpen}
>
  <form class="flex flex-col gap-5" onsubmit={handleSubmit}>
    <!-- Setting up is two steps, numbered so the dialog reads top to bottom:
         get the key into the app, then prove it with a code. -->
    {#if !turningOff}
      <div class="flex flex-col gap-3">
        <p class="font-medium text-sm">
          1. Scan this QR code with your authenticator app.
        </p>
        <div class="flex flex-col items-center gap-2 text-center">
          {#if setup}
            <img
              src={setup.imageUrl}
              alt="QR code for the authenticator app"
              width={160}
              height={160}
              class="size-40 rounded-lg border-8 border-white bg-white"
            />
          {:else}
            <div
              class="flex size-40 items-center justify-center rounded-lg bg-muted px-4 text-muted-foreground text-xs"
            >
              {isPending ? 'Preparing a code to scan…' : ''}
            </div>
          {/if}
          <p class="text-muted-foreground text-xs">
            Can't scan it? Enter this key instead:
          </p>
          <!-- In groups of four, the way authenticator apps show a key, so it
               reads in chunks and wraps between them into even lines, with
               the copy button after the last. -->
          <p
            class="min-h-10 max-w-xs text-balance text-muted-foreground text-xs"
          >
            {#if setup}
              {@const key = setup.totpSecret}
              <code class="font-mono tracking-wide"
                >{key.match(/.{1,4}/g)?.join(' ')}</code
              ><button
                type="button"
                aria-label="Copy key"
                title="Copy key"
                onclick={() => void copyKey(key)}
                class="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md align-middle outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-3.5"
                >
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
              </button>
            {/if}
          </p>
        </div>
      </div>
    {/if}

    <div class="flex flex-col gap-2">
      <Label for={codeId}>
        {turningOff ? 'Code' : '2. Enter the 6-digit code.'}
      </Label>
      <Input
        id={codeId}
        inputmode="numeric"
        autocomplete="one-time-code"
        placeholder="000000"
        required
        bind:value={code}
        disabled={isPending || !ready}
        class="font-mono tracking-widest"
      />
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <DialogFooter>
      <DialogClose disabled={isPending && ready} />
      <Button
        type="submit"
        size="sm"
        variant={turningOff ? 'destructive' : 'default'}
        disabled={isPending || !ready || !/^\d{6}$/.test(code.trim())}
      >
        {isPending && ready ? `Turning ${turning}…` : `Turn ${turning}`}
      </Button>
    </DialogFooter>
  </form>
</DialogSetting>
