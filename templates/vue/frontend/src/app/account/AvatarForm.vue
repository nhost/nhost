<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { removeAvatar, uploadAvatar } from '@/app/account/actions';
import {
  AVATAR_TOO_LARGE,
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/** The controls for the avatar, wrapped around the image itself. */
defineProps<{ canRemove: boolean }>();

const refresh = useRefresh();
const input = useTemplateRef<HTMLInputElement>('input');
const error = ref<string>();
const isPending = ref(false);

async function handleChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  error.value = undefined;

  // Checked here so an oversized file is refused without being sent, and
  // again in the action for a caller that does not come through this.
  if (file.size > MAX_AVATAR_BYTES) {
    error.value = AVATAR_TOO_LARGE;
    target.value = '';
    return;
  }

  isPending.value = true;
  try {
    const body = new FormData();
    body.append('avatar', file);
    const result = await uploadAvatar(body);

    if (result.error) {
      error.value = result.error;
      return;
    }

    // The image above reads its URL from the auth service, so the page is
    // loaded again rather than patched here.
    refresh();
  } catch (err) {
    console.error('Error uploading the avatar:', err);
    error.value = NETWORK_ERROR;
  } finally {
    // Cleared either way, so choosing the same file again still fires.
    target.value = '';
    isPending.value = false;
  }
}

async function handleRemove(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await removeAvatar();

    if (result.error) {
      error.value = result.error;
      return;
    }

    refresh();
  } catch (err) {
    console.error('Error removing the avatar:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div class="relative">
      <slot />
      <div
        v-if="isPending"
        role="status"
        class="absolute inset-0 flex items-center justify-center rounded-full bg-background/60"
      >
        <span
          aria-hidden="true"
          class="size-8 animate-spin rounded-full border-2 border-foreground/25 border-t-foreground"
        />
        <span class="sr-only">Updating the avatar</span>
      </div>
      <input
        ref="input"
        type="file"
        name="avatar"
        :accept="AVATAR_TYPES.join(',')"
        class="sr-only"
        :disabled="isPending"
        aria-label="New avatar image"
        @change="handleChange"
      >
      <!-- Sat on the image's bottom corner rather than under it, where a row
           of buttons competed with the name beside it. -->
      <Button
        type="button"
        variant="secondary"
        size="icon"
        :disabled="isPending"
        aria-label="Upload a new avatar"
        title="Change photo"
        class="absolute -right-0.5 -bottom-0.5 size-6.5 rounded-full ring-2 ring-card hover:bg-accent"
        @click="input?.click()"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          class="size-3"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Button>
    </div>

    <Button
      v-if="canRemove"
      type="button"
      variant="link"
      size="sm"
      :disabled="isPending"
      class="h-auto p-0 text-muted-foreground text-xs"
      @click="handleRemove"
    >
      Remove
    </Button>

    <!-- Narrow and centred under the avatar, which is the column it is in now
         that the name sits beside it. -->
    <p
      v-if="error"
      role="alert"
      class="max-w-36 text-center text-destructive text-xs"
    >
      {{ error }}
    </p>
  </div>
</template>
