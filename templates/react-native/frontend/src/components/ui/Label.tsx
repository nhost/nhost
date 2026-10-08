import { Text } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * A caption for the field under it. There is no `htmlFor` on a native app and
 * nothing to associate: a `TextInput` carries its own `accessibilityLabel`,
 * which is what a screen reader announces.
 */
export function Label({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Text className={cn('font-medium text-neutral-900 text-sm', className)}>
      {children}
    </Text>
  );
}
