<script lang="ts" module>
  import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from 'svelte/elements';
  import { tv, type VariantProps } from 'tailwind-variants';

  // Tailwind v4's preflight gives buttons `cursor: default`, so the pointer has
  // to be asked for.
  export const buttonVariants = tv({
    base: "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  });

  export type ButtonVariants = VariantProps<typeof buttonVariants>;

  // With `href` it renders a link styled as a button.
  export type ButtonProps = ButtonVariants &
    ((HTMLButtonAttributes & { href?: undefined }) | HTMLAnchorAttributes);
</script>

<script lang="ts">
  import { cn } from '#lib/utils.ts';

  let {
    class: className,
    variant,
    size,
    href,
    children,
    ...props
  }: ButtonProps = $props();
</script>

{#if href !== undefined}
  <a
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {href}
    {...props as HTMLAnchorAttributes}
  >
    {@render children?.()}
  </a>
{:else}
  {@const { type = 'submit', ...rest } = props as HTMLButtonAttributes}
  <button
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    {...rest}
  >
    {@render children?.()}
  </button>
{/if}
