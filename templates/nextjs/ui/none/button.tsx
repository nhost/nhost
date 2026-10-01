import * as React from 'react';
import { cn } from '@/lib/utils';

// Tailwind v4's preflight gives buttons `cursor: default`, so the pointer has
// to be asked for. It belongs here rather than on each button: every one of
// them is clickable, and the disabled ones take no pointer events at all.
const buttonBase =
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 shrink-0';

const buttonVariant = {
  default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90',
  outline:
    'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
  secondary:
    'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
} as const;

const buttonSize = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-md gap-1.5 px-3',
  lg: 'h-10 rounded-md px-6',
  icon: 'size-9',
} as const;

type ButtonVariant = keyof typeof buttonVariant;
type ButtonSize = keyof typeof buttonSize;

/**
 * The class list for a button, as a function so a link can be made to look
 * like one. It takes the place of the `cva` call the shadcn/ui version uses,
 * which is the only reason that version needs a dependency to build a string.
 */
function buttonVariants({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  className?: string;
} = {}) {
  return cn(
    buttonBase,
    buttonVariant[variant ?? 'default'],
    buttonSize[size ?? 'default'],
    className,
  );
}

/**
 * Renders the single child it is given with the button's props merged in,
 * which is what `asChild` means: the child element keeps being itself - a
 * `next/link`, usually - and takes on the button's look.
 *
 * The child's own props win, because they are what make it that element,
 * except where both sides have something to say: both handlers run, the
 * child's first, class names and styles combine, and both refs are set. A
 * handler the child leaves undefined is not something to say. That is how
 * `@radix-ui/react-slot` merges, which this stands in for.
 */
function Slot({
  children,
  className,
  style,
  ref,
  ...props
}: React.ComponentProps<'button'>) {
  const composedRef = useComposedRefs(
    ref,
    React.isValidElement<SlotChildProps>(children)
      ? children.props.ref
      : undefined,
  );

  if (!React.isValidElement<SlotChildProps>(children)) {
    if (children || children === 0) {
      throw new Error('Button asChild needs a single element as its child');
    }

    return null;
  }

  const child = children.props;
  const merged: SlotChildProps = { ...props, ...child };

  for (const [key, own] of Object.entries(props)) {
    const theirs = child[key];

    if (!/^on[A-Z]/.test(key) || typeof own !== 'function') {
      continue;
    }

    merged[key] =
      typeof theirs === 'function'
        ? (...args: unknown[]) => {
            const result = theirs(...args);
            own(...args);
            return result;
          }
        : own;
  }

  return React.cloneElement(children, {
    ...merged,
    className: cn(className, child.className),
    style: { ...style, ...child.style },
    ref: composedRef,
  });
}

type SlotChildProps = {
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLElement>;
  [key: string]: unknown;
};

/**
 * composeRefs kept for as long as both refs are, since React detaches and
 * reattaches a callback ref every time it is handed a new one.
 */
function useComposedRefs<T>(
  a: React.Ref<T> | undefined,
  b: React.Ref<T> | undefined,
) {
  return React.useMemo(() => composeRefs(a, b), [a, b]);
}

/**
 * One ref that sets both, or whichever was given when only one was. A callback
 * ref may return its own cleanup; one that does not is called with `null`.
 */
function composeRefs<T>(
  a: React.Ref<T> | undefined,
  b: React.Ref<T> | undefined,
): React.Ref<T> | undefined {
  if (!a || !b) {
    return a ?? b;
  }

  return (node: T | null) => {
    const cleanups = [a, b].map((ref) => setRef(ref, node));

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  };
}

function setRef<T>(ref: React.Ref<T>, node: T | null): VoidFunction {
  if (typeof ref === 'function') {
    const cleanup = ref(node);

    return typeof cleanup === 'function' ? cleanup : () => ref(null);
  }

  if (ref) {
    ref.current = node;
  }

  return () => {
    if (ref) {
      ref.current = null;
    }
  };
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
