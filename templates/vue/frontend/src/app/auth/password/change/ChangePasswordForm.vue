<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { changePassword } from '@/app/auth/password/change/actions';
import ChangedAndSignedOut from '@/app/auth/password/change/ChangedAndSignedOut.vue';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements.vue';
import { meetsRequirements } from '@/app/auth/password/requirements';
import DialogClose from '@/components/DialogClose.vue';
import DialogFooter from '@/components/DialogFooter.vue';
import { useCloseDialog } from '@/components/dialog';
import { useReplacePage } from '@/components/replacePage';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/**
 * `needsCode` is for an account with two-factor on: signing this browser back
 * in with the new password takes a current code from the authenticator app too,
 * so the form asks for one alongside it.
 */
const props = withDefaults(defineProps<{ needsCode?: boolean }>(), {
  needsCode: false,
});

const replacePage = useReplacePage();
const refresh = useRefresh();
const toast = useToast();
const close = useCloseDialog();
const passwordId = useId();
const confirmId = useId();
const rulesId = useId();
const codeId = useId();

const password = ref('');
const confirm = ref('');
const code = ref('');
const error = ref<string>();
const isPending = ref(false);

const ready = computed(
  () =>
    meetsRequirements(password.value, confirm.value) &&
    (!props.needsCode || /^\d{6}$/.test(code.value.trim())),
);

async function handleSubmit(): Promise<void> {
  error.value = undefined;

  if (password.value !== confirm.value) {
    error.value = 'The two passwords do not match.';
    return;
  }

  isPending.value = true;
  try {
    const result = await changePassword(
      password.value,
      props.needsCode ? code.value.trim() : undefined,
    );
    if (result.error) {
      error.value = result.error;
      return;
    }

    // Signed back in, so the page stays: only the other devices lost their
    // session, and the session list under this is re-read.
    if (result.signedIn) {
      close();
      toast('Password changed');
      refresh();
      return;
    }

    replacePage(ChangedAndSignedOut);
  } catch (err) {
    console.error('Error changing the password:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}
</script>

<template>
  <!-- What changing it costs is the dialog's description, above this. -->
  <form class="flex flex-col gap-5" @submit.prevent="handleSubmit">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label :for="passwordId">New password</Label>
        <Input
          :id="passwordId"
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          :disabled="isPending"
          :aria-describedby="rulesId"
        />
      </div>

      <div class="flex flex-col gap-2">
        <Label :for="confirmId">Confirm new password</Label>
        <Input
          :id="confirmId"
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          required
          :disabled="isPending"
          :aria-describedby="rulesId"
        />
      </div>

      <PasswordRequirements
        :id="rulesId"
        :password="password"
        :confirm="confirm"
        class="flex-row flex-wrap items-start gap-x-4 text-xs"
      />

      <div v-if="needsCode" class="flex flex-col gap-2">
        <Label :for="codeId">Authenticator code</Label>
        <Input
          :id="codeId"
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="000000"
          required
          :disabled="isPending"
          class="font-mono tracking-widest"
        />
      </div>
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <DialogFooter>
      <DialogClose :disabled="isPending" />
      <Button type="submit" size="sm" :disabled="isPending || !ready">
        {{ isPending ? 'Changing…' : 'Change password' }}
      </Button>
    </DialogFooter>
  </form>
</template>
