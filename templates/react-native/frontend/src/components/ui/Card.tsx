import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'gap-6 rounded-xl border border-neutral-200 bg-white p-6',
        className,
      )}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <View className="gap-1.5">{children}</View>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="font-semibold text-neutral-900 text-lg">{children}</Text>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <Text className="text-neutral-500 text-sm">{children}</Text>;
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={cn('gap-4', className)}>{children}</View>;
}
