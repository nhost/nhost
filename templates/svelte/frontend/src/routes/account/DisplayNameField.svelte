<!-- @component The display name as the profile shows it, editable in place. -->
<script lang="ts">
  import { useToast } from '#lib/components/toast.svelte.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { refreshAll } from '$app/navigation';
  import { updateDisplayName } from './actions.remote.ts';

  let { displayName }: { displayName: string } = $props();

  const toast = useToast();
  const nameId = $props.id();
  let input = $state<HTMLInputElement | null>(null);

  let editing = $state(false);
  let name = $state('');
  let error = $state<string>();
  let isPending = $state(false);

  $effect(() => {
    if (editing) {
      input?.select();
    }
  });

  // Starts from what the page was given, so a cancelled edit leaves nothing
  // behind the next time this opens.
  const startEditing = (): void => {
    name = displayName;
    editing = true;
  };

  const stopEditing = (): void => {
    editing = false;
    error = undefined;
  };

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;
    isPending = true;
    try {
      const result = await updateDisplayName(name);
      if (result.error) {
        error = result.error;
        return;
      }

      editing = false;
      toast('Name saved');
      // The name shown here comes from the auth service, so the page loads
      // again rather than being patched.
      await refreshAll();
    } catch (err) {
      console.error('Error saving the display name:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };
</script>

{#if !editing}
  <!-- Wraps rather than truncates: the name is what the card is for. -->
  <p
    class="min-w-0 font-semibold text-xl leading-tight [overflow-wrap:anywhere]"
  >
    {displayName}
    <!-- Always shown rather than on hover: a phone has no hover, and a pencil
         is small enough not to crowd the name. -->
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Edit name"
      title="Edit name"
      class="-my-1 ml-1 size-7 align-middle text-muted-foreground hover:text-foreground"
      onclick={startEditing}
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
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    </Button>
  </p>
{:else}
  <!-- Escape cancels from anywhere in the form, the buttons included. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    class="flex flex-col gap-2"
    onsubmit={handleSubmit}
    onkeydown={(event) => {
      if (event.key === 'Escape' && !isPending) {
        stopEditing();
      }
    }}
  >
    <!-- The name is right here when the form is closed, so the label is for a
         screen reader rather than for the eye. -->
    <Label for={nameId} class="sr-only">Display name</Label>
    <div class="flex items-center gap-2">
      <Input
        bind:ref={input}
        id={nameId}
        type="text"
        autocomplete="name"
        required
        bind:value={name}
        disabled={isPending}
        class="h-8 min-w-0 flex-1"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onclick={stopEditing}
      >
        Cancel
      </Button>
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}
  </form>
{/if}
