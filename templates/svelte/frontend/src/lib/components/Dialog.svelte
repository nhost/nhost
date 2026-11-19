<!-- @component A modal on the browser's own `<dialog>`. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { provideCloseDialog } from './dialog.ts';
  import ToastStatus from './ToastStatus.svelte';

  let {
    open,
    onOpenChange,
    title,
    description,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement;
  let pressedBackdrop = false;
  const id = $props.id();

  $effect(() => {
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  const close = (): void => onOpenChange(false);
  provideCloseDialog(close);
</script>

<!-- biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard's way out is Escape, which the element handles itself -->
<dialog
  bind:this={dialog}
  aria-labelledby={`${id}-title`}
  aria-describedby={description ? `${id}-description` : undefined}
  onclose={close}
  onpointerdown={(event) => {
    // The contents fill the dialog, so a press that lands on the element
    // itself is on the backdrop.
    pressedBackdrop = event.target === event.currentTarget;
  }}
  onclick={(event) => {
    if (pressedBackdrop && event.target === event.currentTarget) {
      close();
    }
  }}
  class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/60"
>
  {#if open}
    <div class="flex flex-col gap-5 p-6">
      <div class="flex flex-col gap-1.5">
        <h2 id={`${id}-title`} class="font-semibold text-lg leading-tight">
          {title}
        </h2>
        {#if description}
          <p id={`${id}-description`} class="text-muted-foreground text-sm">
            {description}
          </p>
        {/if}
      </div>
      {@render children()}
      <ToastStatus />
    </div>
  {/if}
</dialog>
