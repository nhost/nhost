import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinkErrorNotice } from '@/components/LinkErrorNotice';

/**
 * The frame every screen sits in: on iOS the scroll view insets its content by
 * the keyboard, so a field or button under it can still be scrolled to, and it
 * is padded clear of the home indicator.
 * It carries the notice for a link that failed, which can land on any screen.
 */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      className="flex-1 bg-neutral-50"
      contentContainerClassName="gap-4 p-6"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <LinkErrorNotice />
      {children}
    </ScrollView>
  );
}
