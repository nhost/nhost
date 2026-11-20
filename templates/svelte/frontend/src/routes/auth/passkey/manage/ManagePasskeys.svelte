<script lang="ts" module>
  const ANOTHER_DEVICE = 'To add another, use your phone or a security key.';
</script>

<script lang="ts">
  import {
    browserSupportsWebAuthn,
    startRegistration,
  } from '@simplewebauthn/browser';
  import DialogClose from '#lib/components/DialogClose.svelte';
  import DialogFooter from '#lib/components/DialogFooter.svelte';
  import { useCloseDialog } from '#lib/components/dialog.ts';
  import { useToast } from '#lib/components/toast.svelte.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { useRemoved } from '#lib/components/useRemoved.svelte.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { refreshAll } from '$app/navigation';
  import { wasCancelled } from '../cancelled.ts';
  import {
    alreadyRegistered,
    forgetPasskey,
    passkeysOnThisDevice,
    rememberPasskey,
  } from '../thisDevice.ts';
  import {
    beginAddPasskey,
    finishAddPasskey,
    type Passkey,
    removePasskey,
  } from './actions.remote.ts';
  import { deviceName, passkeyName, unusedName } from './names.ts';

  let { keys: listed }: { keys: Passkey[] } = $props();

  const toast = useToast();
  const close = useCloseDialog();
  const nicknameId = $props.id();

  // Gone from the list as soon as Remove is pressed, rather than once the page
  // has loaded again (see `useRemoved`).
  const { removed, remove, restore } = useRemoved();
  const keys = $derived(listed.filter((key) => !removed.has(key.id)));

  let onThisDevice = $state(passkeysOnThisDevice());

  // The device would refuse a second passkey for this account (see
  // `alreadyRegistered`), so the dialog says so before Add is pressed.
  const here = $derived(keys.find((key) => onThisDevice.has(key.credentialId)));

  // Starts as the device it is added on, numbered past any passkey already
  // called that, for the user to keep or change; blank when this device has
  // one, since the next has to come from another.
  const device = deviceName(navigator.userAgent);
  let nickname = $state(
    // svelte-ignore state_referenced_locally
    device && !here
      ? unusedName(
          device,
          // svelte-ignore state_referenced_locally
          keys.map((key) => key.nickname),
        )
      : '',
  );
  let error = $state<string>();
  let pending = $state<string>();

  const handleAdd = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;

    if (!browserSupportsWebAuthn()) {
      error = 'This browser does not support passkeys.';
      return;
    }

    pending = 'add';
    try {
      const begun = await beginAddPasskey();
      if (begun.error || !begun.options) {
        error = begun.error ?? 'Could not start adding a passkey.';
        return;
      }

      const credential = await startRegistration({
        optionsJSON: begun.options,
      });
      const result = await finishAddPasskey({ credential, nickname });
      if (result.error) {
        error = result.error;
        return;
      }
      rememberPasskey(credential.id);

      // Adding is what the dialog was opened for, so it closes.
      close();
      toast('Passkey added');
      await refreshAll();
    } catch (err) {
      if (wasCancelled(err)) {
        error = 'The passkey prompt was cancelled.';
        return;
      }

      if (alreadyRegistered(err)) {
        error = `This device already has a passkey for your account. ${ANOTHER_DEVICE}`;
        return;
      }

      console.error('Error adding a passkey:', err);
      error = 'The passkey could not be added. Try again.';
    } finally {
      pending = undefined;
    }
  };

  // Stays open after a removal, with the list read again under it, in case
  // there is another to remove.
  const handleRemove = async (key: Passkey): Promise<void> => {
    error = undefined;
    remove(key.id);
    try {
      const result = await removePasskey(key.id);
      if (result.error) {
        restore(key.id);
        error = result.error;
        return;
      }

      forgetPasskey(key.credentialId);
      onThisDevice = passkeysOnThisDevice();
      toast('Passkey removed');
      await refreshAll();
    } catch (err) {
      console.error('Error removing a passkey:', err);
      restore(key.id);
      error = NETWORK_ERROR;
    }
  };
</script>

<form class="flex flex-col gap-5" onsubmit={handleAdd}>
  {#if keys.length > 0}
    <ul class="divide-y rounded-lg border">
      {#each keys as key, index (key.id)}
        <li
          class="flex items-center justify-between gap-4 py-2 pr-2 pl-3 text-sm"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="min-w-0 truncate">{passkeyName(key, index)}</span>
            {#if key === here}
              <span
                class="shrink-0 whitespace-nowrap rounded-full border bg-secondary px-2 text-xs"
              >
                This device
              </span>
            {/if}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="text-destructive hover:text-destructive"
            disabled={pending === 'add'}
            onclick={() => void handleRemove(key)}
          >
            Remove
          </Button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if here}
    <p class="text-muted-foreground text-sm">
      This browser already has a passkey for your account. {ANOTHER_DEVICE}
    </p>
  {/if}

  <div class="flex flex-col gap-2">
    <Label for={nicknameId}>
      {keys.length === 0 ? 'Name' : 'Name for a new passkey'}
    </Label>
    <Input
      id={nicknameId}
      type="text"
      autocomplete="off"
      placeholder={here ? 'My phone' : 'This laptop'}
      bind:value={nickname}
      disabled={Boolean(pending)}
    />
  </div>

  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}

  <DialogFooter>
    <DialogClose disabled={pending === 'add'}>
      {keys.length === 0 ? 'Cancel' : 'Done'}
    </DialogClose>
    <Button type="submit" size="sm" disabled={Boolean(pending)}>
      {pending === 'add' ? 'Waiting for your device…' : 'Add passkey'}
    </Button>
  </DialogFooter>
</form>
