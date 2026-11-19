<!-- @component The answers to a dialog that asks before it acts. -->
<script lang="ts">
  import DialogClose from '#lib/components/DialogClose.svelte';
  import DialogFooter from '#lib/components/DialogFooter.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';

  let {
    confirm,
    pending: pendingLabel,
    cancel = 'Cancel',
    destructive = false,
    typeToConfirm,
    onConfirm,
  }: {
    confirm: string;
    pending: string;
    cancel?: string;
    destructive?: boolean;
    typeToConfirm?: string;
    /** Resolves to an error to show, or to nothing once it has acted. */
    onConfirm: () => Promise<string | undefined>;
  } = $props();

  const typedId = $props.id();
  let typed = $state('');
  let error = $state<string>();
  let pending = $state(false);

  const confirmed = $derived(!typeToConfirm || typed.trim() === typeToConfirm);

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (!confirmed) {
      return;
    }

    error = undefined;
    pending = true;
    try {
      error = await onConfirm();
    } finally {
      pending = false;
    }
  };
</script>

<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
  {#if typeToConfirm}
    <div class="flex flex-col gap-2">
      <!-- One span, so the label's flex gap does not space out the word. -->
      <Label for={typedId} class="font-normal">
        <span>
          Type <span class="font-semibold">{typeToConfirm}</span> to confirm
        </span>
      </Label>
      <Input
        id={typedId}
        autocomplete="off"
        bind:value={typed}
        disabled={pending}
      />
    </div>
  {/if}

  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}

  <DialogFooter>
    <DialogClose disabled={pending}>{cancel}</DialogClose>
    <Button
      type="submit"
      size="sm"
      variant={destructive ? 'destructive' : 'default'}
      disabled={pending || !confirmed}
    >
      {pending ? pendingLabel : confirm}
    </Button>
  </DialogFooter>
</form>
