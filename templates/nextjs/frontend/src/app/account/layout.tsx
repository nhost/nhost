import type { ReactNode } from 'react';
import ReplacePageLayout from '@/components/ReplacePageLayout';
import ToastProvider from '@/components/Toast';

// The toasts sit outside the replaced page, so the one a form shows as it
// finishes is still there after the page under it renders again.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ReplacePageLayout>{children}</ReplacePageLayout>
    </ToastProvider>
  );
}
