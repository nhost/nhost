<!-- @component A row whose button opens a dialog with `children` in it. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { cn } from '#lib/utils.ts';
  import Dialog from './Dialog.svelte';
  import SettingRow from './SettingRow.svelte';

  let {
    label,
    value,
    action,
    title,
    description,
    destructive = false,
    open = $bindable(false),
    onOpen,
    children,
  }: {
    label: string;
    value: string | Snippet;
    action: string;
    title: string;
    description?: string;
    destructive?: boolean;
    open?: boolean;
    /** Called as the row's button opens the dialog. */
    onOpen?: VoidFunction;
    children: Snippet;
  } = $props();
</script>

<SettingRow {label} {value}>
  <Button
    type="button"
    variant="outline"
    size="sm"
    aria-haspopup="dialog"
    class={cn(
      'shrink-0',
      destructive && 'text-destructive hover:text-destructive',
    )}
    onclick={() => {
      onOpen?.();
      open = true;
    }}
  >
    {action}
  </Button>
  <Dialog
    {open}
    onOpenChange={(next) => {
      open = next;
    }}
    {title}
    {description}
  >
    {@render children()}
  </Dialog>
</SettingRow>
