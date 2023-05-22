import { Container } from '@/components/layout/Container';
import { AccountSettingsLayout } from '@/features/account/settings/components/AccountSettingsLayout';
import type { ReactElement } from 'react';

export default function ProfileSettingsPage() {
  return <span>Hello</span>;
}

ProfileSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AccountSettingsLayout>
      <Container
        className="grid max-w-5xl grid-flow-row gap-8 bg-transparent"
        rootClassName="bg-transparent"
      >
        {page}
      </Container>
    </AccountSettingsLayout>
  );
};
