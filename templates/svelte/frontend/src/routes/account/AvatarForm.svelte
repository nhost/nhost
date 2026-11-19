<!-- @component The controls for the avatar, wrapped around the image itself. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { refreshAll } from '$app/navigation';
  import { removeAvatar, uploadAvatar } from './actions.remote.ts';
  import {
    AVATAR_TOO_LARGE,
    AVATAR_TYPES,
    MAX_AVATAR_BYTES,
  } from './avatar.ts';

  let { canRemove, children }: { canRemove: boolean; children: Snippet } =
    $props();

  let input = $state<HTMLInputElement>();
  let error = $state<string>();
  let isBusy = $state(false);

  const handleChange = async (event: Event): Promise<void> => {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];

    if (!file || isBusy) {
      return;
    }

    error = undefined;

    // Checked here so an oversized file is refused without being sent, and
    // again on the server for a caller that does not come through this.
    if (file.size > MAX_AVATAR_BYTES) {
      error = AVATAR_TOO_LARGE;
      target.value = '';
      return;
    }

    isBusy = true;
    try {
      // A successful form loads the page again, so the image above shows the
      // new URL once this resolves.
      await uploadAvatar.submit();
      error = uploadAvatar.result?.error;
    } catch (err) {
      console.error('Error uploading the avatar:', err);
      error = NETWORK_ERROR;
    } finally {
      // Cleared either way, so choosing the same file again still fires.
      target.value = '';
      isBusy = false;
    }
  };

  const handleRemove = async (): Promise<void> => {
    error = undefined;
    isBusy = true;
    try {
      const result = await removeAvatar();

      if (result.error) {
        error = result.error;
        return;
      }

      await refreshAll();
    } catch (err) {
      console.error('Error removing the avatar:', err);
      error = NETWORK_ERROR;
    } finally {
      isBusy = false;
    }
  };
</script>

<div class="flex flex-col items-center gap-1">
  <form {...uploadAvatar} enctype="multipart/form-data" class="relative">
    {@render children()}
    {#if isBusy}
      <div
        role="status"
        class="absolute inset-0 flex items-center justify-center rounded-full bg-background/60"
      >
        <span
          aria-hidden="true"
          class="size-8 animate-spin rounded-full border-2 border-foreground/25 border-t-foreground"
        ></span>
        <span class="sr-only">Updating the avatar</span>
      </div>
    {/if}
    <!-- Never disabled: the form is read as it submits, and a disabled input
         would leave the file out. -->
    <input
      bind:this={input}
      {...uploadAvatar.fields.avatar.as('file')}
      accept={AVATAR_TYPES.join(',')}
      class="sr-only"
      aria-label="New avatar image"
      onchange={(event) => void handleChange(event)}
    />
    <!-- Sat on the image's bottom corner rather than under it, where a row of
         buttons competed with the name beside it. -->
    <Button
      type="button"
      variant="secondary"
      size="icon"
      disabled={isBusy}
      aria-label="Upload a new avatar"
      title="Change photo"
      class="absolute -right-0.5 -bottom-0.5 size-6.5 rounded-full ring-2 ring-card hover:bg-accent"
      onclick={() => input?.click()}
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
  </form>

  {#if canRemove}
    <Button
      type="button"
      variant="link"
      size="sm"
      disabled={isBusy}
      class="h-auto p-0 text-muted-foreground text-xs"
      onclick={() => void handleRemove()}
    >
      Remove
    </Button>
  {/if}

  <!-- Narrow and centred under the avatar, which is the column it is in now
       that the name sits beside it. -->
  {#if error}
    <p role="alert" class="max-w-36 text-center text-destructive text-xs">
      {error}
    </p>
  {/if}
</div>
