import {
  StandaloneLayout,
  type StandaloneLayoutProps,
} from '@/components/layout/StandaloneLayout';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';

export type AccountSettingsLayoutProps = StandaloneLayoutProps;

/**
 * The header across the top and the account settings below. The page fills
 * the height so only its settings column scrolls, like project settings.
 */
export default function AccountSettingsLayout({
  children,
  ...props
}: AccountSettingsLayoutProps) {
  return (
    <StandaloneLayout {...props}>
      <AuthGuard>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </AuthGuard>
    </StandaloneLayout>
  );
}
