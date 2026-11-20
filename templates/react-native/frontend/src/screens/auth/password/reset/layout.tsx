import { Slot } from 'expo-router';
import ReplacePageLayout from '@/components/ReplacePageLayout';

// The changed card stays once the save has cleared the session, rather than
// the screen's "no longer works" for a visitor without one.
export default function ResetPasswordLayout() {
  return (
    <ReplacePageLayout>
      <Slot />
    </ReplacePageLayout>
  );
}
