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

  // Calls `onBroken` if the image fails to load, including when it failed
  // before hydration. An `onerror` attribute would do that through an inline
  // handler, which the content security policy blocks.
  const whenBroken =
    (onBroken: () => void) =>
    (img: HTMLImageElement): (() => void) => {
      if (img.complete && img.naturalWidth === 0) {
        onBroken();
      }
      img.addEventListener('error', onBroken);
      return () => img.removeEventListener('error', onBroken);
    };
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

  const src = $derived(avatarUrl ? avatarSrc(avatarUrl, width) : undefined);

  // The src that failed to load, such as a provider's picture that is gone or
  // rate-limited, so the initial shows instead of a broken image.
  let broken = $state<string>();
</script>

<div
  aria-hidden="true"
  class={cn(
    'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground',
    className,
  )}
>
  {initialOf(displayName)}
  {#if src && src !== broken}
    <img
      {src}
      alt=""
      class="absolute inset-0 size-full object-cover"
      {@attach whenBroken(() => {
        broken = src;
      })}
    />
  {/if}
</div>
