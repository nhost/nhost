<!--
  @component
  The account's picture over its initial, so the initial shows wherever the
  picture does not paint.
-->
<script lang="ts" module>
  // Falls back to a dot rather than an empty disc: a display name can be an
  // empty string, and an account made by magic link often starts that way.
  const initialOf = (displayName: string): string =>
    displayName.trim().slice(0, 1).toUpperCase() || '·';
</script>

<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { type AvatarWidth, avatarSrc } from '#routes/account/avatar.ts';

  let {
    avatarUrl,
    displayName,
    width,
    class: className,
  }: {
    avatarUrl: string | undefined;
    displayName: string;
    width: AvatarWidth;
    class?: string;
  } = $props();
</script>

<div
  aria-hidden="true"
  class={cn(
    'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground',
    className,
  )}
>
  {initialOf(displayName)}
  {#if avatarUrl}
    <img
      src={avatarSrc(avatarUrl, width)}
      alt=""
      class="absolute inset-0 size-full object-cover"
    />
  {/if}
</div>
