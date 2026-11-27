<script setup lang="ts">
import {
  browserSupportsWebAuthn,
  startRegistration,
} from '@simplewebauthn/browser';
import { computed, ref, useId } from 'vue';
import { wasCancelled } from '@/app/auth/passkey/cancelled';
import {
  beginAddPasskey,
  finishAddPasskey,
  type Passkey,
  removePasskey,
} from '@/app/auth/passkey/manage/actions';
import {
  deviceName,
  passkeyName,
  unusedName,
} from '@/app/auth/passkey/manage/names';
import {
  alreadyRegistered,
  forgetPasskey,
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/app/auth/passkey/thisDevice';
import DialogClose from '@/components/DialogClose.vue';
import DialogFooter from '@/components/DialogFooter.vue';
import { useCloseDialog } from '@/components/dialog';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { useRemoved } from '@/components/useRemoved';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

const ANOTHER_DEVICE = 'To add another, use your phone or a security key.';

const props = defineProps<{ keys: Passkey[] }>();

const refresh = useRefresh();
const toast = useToast();
const close = useCloseDialog();
const nicknameId = useId();

// Gone from the list as soon as Remove is pressed, rather than once the
// refreshed page arrives (see `useRemoved`).
const { removed, remove, restore } = useRemoved();
const keys = computed(() =>
  props.keys.filter((key) => !removed.value.has(key.id)),
);

const onThisDevice = ref(passkeysOnThisDevice());

// The device would refuse a second passkey for this account (see
// `alreadyRegistered`), so the dialog says so before Add is pressed.
const here = computed(() =>
  keys.value.find((key) => onThisDevice.value.has(key.credentialId)),
);

// Starts as the device it is added on, numbered past any passkey already
// called that, for the user to keep or change; blank when this device has one,
// since the next has to come from another.
const device = deviceName(navigator.userAgent);
const nickname = ref(
  device && !here.value
    ? unusedName(
        device,
        keys.value.map((key) => key.nickname),
      )
    : '',
);
const error = ref<string>();
const pending = ref<string>();

async function handleAdd(): Promise<void> {
  error.value = undefined;

  if (!browserSupportsWebAuthn()) {
    error.value = 'This browser does not support passkeys.';
    return;
  }

  pending.value = 'add';
  try {
    const begun = await beginAddPasskey();
    if (begun.error || !begun.options) {
      error.value = begun.error ?? 'Could not start adding a passkey.';
      return;
    }

    const credential = await startRegistration({
      optionsJSON: begun.options,
    });
    const result = await finishAddPasskey(credential, nickname.value);
    if (result.error) {
      error.value = result.error;
      return;
    }
    rememberPasskey(credential.id);

    // Adding is what the dialog was opened for, so it closes.
    close();
    toast('Passkey added');
    refresh();
  } catch (err) {
    if (wasCancelled(err)) {
      error.value = 'The passkey prompt was cancelled.';
      return;
    }

    if (alreadyRegistered(err)) {
      error.value = `This device already has a passkey for your account. ${ANOTHER_DEVICE}`;
      return;
    }

    console.error('Error adding a passkey:', err);
    error.value = 'The passkey could not be added. Try again.';
  } finally {
    pending.value = undefined;
  }
}

// Stays open after a removal, with the list re-read under it, in case there is
// another to remove.
async function handleRemove(key: Passkey): Promise<void> {
  error.value = undefined;
  remove(key.id);
  try {
    const result = await removePasskey(key.id);
    if (result.error) {
      restore(key.id);
      error.value = result.error;
      return;
    }

    forgetPasskey(key.credentialId);
    onThisDevice.value = passkeysOnThisDevice();
    toast('Passkey removed');
    refresh();
  } catch (err) {
    console.error('Error removing a passkey:', err);
    restore(key.id);
    error.value = NETWORK_ERROR;
  }
}
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="handleAdd">
    <ul v-if="keys.length > 0" class="divide-y rounded-lg border">
      <li
        v-for="(key, index) in keys"
        :key="key.id"
        class="flex items-center justify-between gap-4 py-2 pr-2 pl-3 text-sm"
      >
        <span class="flex min-w-0 items-center gap-2">
          <span class="min-w-0 truncate">{{ passkeyName(key, index) }}</span>
          <span
            v-if="key === here"
            class="shrink-0 whitespace-nowrap rounded-full border bg-secondary px-2 text-xs"
          >
            This device
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="text-destructive hover:text-destructive"
          :disabled="pending === 'add'"
          @click="handleRemove(key)"
        >
          Remove
        </Button>
      </li>
    </ul>

    <p v-if="here" class="text-muted-foreground text-sm">
      This browser already has a passkey for your account. {{ ANOTHER_DEVICE }}
    </p>

    <div class="flex flex-col gap-2">
      <Label :for="nicknameId">
        {{ keys.length === 0 ? 'Name' : 'Name for a new passkey' }}
      </Label>
      <Input
        :id="nicknameId"
        v-model="nickname"
        type="text"
        autocomplete="off"
        :placeholder="here ? 'My phone' : 'This laptop'"
        :disabled="Boolean(pending)"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <DialogFooter>
      <DialogClose :disabled="pending === 'add'">
        {{ keys.length === 0 ? 'Cancel' : 'Done' }}
      </DialogClose>
      <Button type="submit" size="sm" :disabled="Boolean(pending)">
        {{ pending === 'add' ? 'Waiting for your device…' : 'Add passkey' }}
      </Button>
    </DialogFooter>
  </form>
</template>
