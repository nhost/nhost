import { Slot } from 'expo-router';
import ReplacePageLayout from '@/components/ReplacePageLayout';

// Inside the screen's frame, so a replacement scrolls and stays guarded like
// the screen it replaces. The toasts are the root layout's, outside it.
export default function AccountLayout() {
  return (
    <ReplacePageLayout>
      <Slot />
    </ReplacePageLayout>
  );
}
