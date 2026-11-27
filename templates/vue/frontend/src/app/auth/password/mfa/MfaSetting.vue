<script setup lang="ts">
import type { User } from '@nhost/nhost-js/auth';
import { computed, ref, useId } from 'vue';
import {
  disableMfa,
  enableMfa,
  generateMfa,
  type MfaSetup,
} from '@/app/auth/password/mfa/actions';
import DialogClose from '@/components/DialogClose.vue';
import DialogFooter from '@/components/DialogFooter.vue';
import DialogSetting from '@/components/DialogSetting.vue';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { cn } from '@/lib/utils';

/** Two-factor, as a row on the account page. */
const props = defineProps<{ user: User }>();

// What a change here made it, until the refreshed page agrees: reopening the
// dialog before then would otherwise offer the change just made.
const reported = computed(() => props.user.activeMfaType === 'totp');
const changed = ref<{ from: boolean; to: boolean }>();
const active = computed(() =>
  changed.value?.from === reported.value ? changed.value.to : reported.value,
);
const refresh = useRefresh();
const toast = useToast();
// The copied key's toast goes when the dialog does: it is about a key that is
// no longer on screen.
let dismissCopied: VoidFunction | undefined;
const codeId = useId();

const open = ref(false);
// Which way the dialog was opened.
const turningOff = ref(active.value);
const setup = ref<MfaSetup>();
const code = ref('');
const error = ref<string>();
const isPending = ref(false);

async function start(): Promise<void> {
  isPending.value = true;
  try {
    const result = await generateMfa();
    if (result.error || !result.setup) {
      error.value = result.error ?? 'Could not start the setup.';
      return;
    }

    setup.value = result.setup;
  } catch (err) {
    console.error('Error starting the two-factor setup:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}

function handleOpen(): void {
  code.value = '';
  error.value = undefined;
  turningOff.value = active.value;
  // A fresh secret on every opening. The backend stores it on the account
  // right away, and one shown earlier and closed is not worth keeping.
  if (!active.value) {
    setup.value = undefined;
    void start();
  }
}

function onOpenChange(next: boolean): void {
  if (!next) {
    dismissCopied?.();
  }
  open.value = next;
}

async function handleSubmit(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = turningOff.value
      ? await disableMfa(code.value)
      : await enableMfa(code.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    // The page reads the account's state from the auth service, so the row
    // changes when it is rendered again rather than being guessed at here.
    changed.value = { from: reported.value, to: !turningOff.value };
    open.value = false;
    code.value = '';
    toast(turningOff.value ? 'Two-factor is off' : 'Two-factor is on');
    refresh();
  } catch (err) {
    console.error('Error changing two-factor:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}

// Typing a key this long from the screen is where entering it by hand goes
// wrong, so it can be pasted instead.
async function copyKey(key: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(key);
    dismissCopied = toast('Key copied');
  } catch (err) {
    console.error('Error copying the two-factor key:', err);
    toast('Could not copy the key');
  }
}

const ready = computed(() => turningOff.value || setup.value !== undefined);
const turning = computed(() => (turningOff.value ? 'off' : 'on'));
</script>

<template>
  <DialogSetting
    label="Two-factor"
    :action="active ? 'Turn off' : 'Set up'"
    :title="turningOff ? 'Turn off two-factor' : 'Set up two-factor'"
    :description="
      turningOff
        ? 'Enter a current code from your authenticator app to turn it off.'
        : 'Asks for a code from an authenticator app when you sign in with your password. Other sign-in methods and emailed links skip it.'
    "
    :open="open"
    @update:open="onOpenChange"
    @opening="handleOpen"
  >
    <template #value>
      <span class="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          :class="
            cn(
              'size-1.5 rounded-full',
              active ? 'bg-success' : 'bg-muted-foreground/60',
            )
          "
        />
        {{ active ? 'On' : 'Off' }}
      </span>
    </template>

    <form class="flex flex-col gap-5" @submit.prevent="handleSubmit">
      <!-- Setting up is two steps, numbered so the dialog reads top to bottom:
           get the key into the app, then prove it with a code. -->
      <div v-if="!turningOff" class="flex flex-col gap-3">
        <p class="font-medium text-sm">
          1. Scan this QR code with your authenticator app.
        </p>
        <div class="flex flex-col items-center gap-2 text-center">
          <img
            v-if="setup"
            :src="setup.imageUrl"
            alt="QR code for the authenticator app"
            width="160"
            height="160"
            class="size-40 rounded-lg border-8 border-white bg-white"
          >
          <div
            v-else
            class="flex size-40 items-center justify-center rounded-lg bg-muted px-4 text-muted-foreground text-xs"
          >
            <template v-if="isPending">Preparing a code to scan…</template>
          </div>
          <p class="text-muted-foreground text-xs">
            Can't scan it? Enter this key instead:
          </p>
          <!-- In groups of four, the way authenticator apps show a key, so it
               reads in chunks and wraps between them into even lines, with the
               copy button after the last. -->
          <p
            class="min-h-10 max-w-xs text-balance text-muted-foreground text-xs"
          >
            <template v-if="setup">
              <code class="font-mono tracking-wide">{{
                setup.totpSecret.match(/.{1,4}/g)?.join(' ')
              }}</code>
              <button
                type="button"
                aria-label="Copy key"
                title="Copy key"
                class="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md align-middle outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                @click="copyKey(setup.totpSecret)"
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
            </template>
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <Label :for="codeId">
          {{ turningOff ? 'Code' : '2. Enter the 6-digit code.' }}
        </Label>
        <Input
          :id="codeId"
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="000000"
          required
          :disabled="isPending || !ready"
          class="font-mono tracking-widest"
        />
      </div>

      <p v-if="error" role="alert" class="text-destructive text-sm">
        {{ error }}
      </p>

      <DialogFooter>
        <DialogClose :disabled="isPending && ready" />
        <Button
          type="submit"
          size="sm"
          :variant="turningOff ? 'destructive' : 'default'"
          :disabled="isPending || !ready || !/^\d{6}$/.test(code.trim())"
        >
          {{ isPending && ready ? `Turning ${turning}…` : `Turn ${turning}` }}
        </Button>
      </DialogFooter>
    </form>
  </DialogSetting>
</template>
