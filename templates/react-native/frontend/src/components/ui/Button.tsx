import { ActivityIndicator, Pressable, Text } from 'react-native';
import { cn } from '@/lib/utils';

const buttonVariant = {
  default: 'bg-neutral-900 active:bg-neutral-700',
  outline: 'border border-neutral-300 bg-white active:bg-neutral-100',
  ghost: 'active:bg-neutral-100',
  link: '',
} as const;

const labelVariant = {
  default: 'text-white',
  outline: 'text-neutral-900',
  ghost: 'text-neutral-900',
  link: 'text-neutral-900 underline',
} as const;

const buttonSize = {
  default: 'h-11 px-4',
  sm: 'h-9 px-3',
  link: 'h-auto p-0',
} as const;

// What each size takes past its top and bottom, so a finger has 44pt to hit.
// NativeWind makes 1rem 14pt on a device, so `default` is 38.5 tall, `sm` 31.5
// and a `link` line 17.5. Two targets whose slop adds up to more than the gap
// between them overlap, and the later one takes the tap there.
const hitSlop = {
  default: { top: 2.75, bottom: 2.75 },
  sm: { top: 6.25, bottom: 6.25 },
  link: { top: 13.25, bottom: 13.25 },
} as const;

const labelSize = {
  default: 'text-base',
  sm: 'text-sm',
  link: 'text-sm',
} as const;

export type ButtonVariant = keyof typeof buttonVariant;
export type ButtonSize = keyof typeof buttonSize;

export type ButtonProps = {
  children: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
};

/**
 * There is no `asChild` here, and nothing like it.
 *
 * On the web a button that navigates has to stay an anchor, so the shadcn/ui
 * versions of this component merge their look onto a link. A React Native app
 * has no anchors: a control navigates by calling `push`, `replace` or `backTo`
 * on `useGo()` from `@/lib/navigation` in its `onPress`, which a Button already
 * takes. So there is nothing to merge a Button onto.
 */
export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  isPending = false,
  className,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isPending }}
      disabled={disabled || isPending}
      // Slop only counts inside the nearest native parent, the Card or the
      // scroll view's content, as the rows between flatten away. A background,
      // border or testID on a row stops that.
      hitSlop={hitSlop[size]}
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-lg',
        buttonVariant[variant],
        buttonSize[size],
        (disabled || isPending) && 'opacity-50',
        className,
      )}
    >
      {isPending ? (
        <ActivityIndicator
          size="small"
          color={variant === 'default' ? '#ffffff' : '#171717'}
        />
      ) : null}
      <Text
        className={cn('font-medium', labelVariant[variant], labelSize[size])}
      >
        {children}
      </Text>
    </Pressable>
  );
}
