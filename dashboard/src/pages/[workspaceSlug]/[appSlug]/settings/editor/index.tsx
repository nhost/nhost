import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { TOMLEditor } from '@/features/projects/common/components/settings/TOMLEditor';
import type { ReactElement } from 'react';

export default function TOMLEditorPage() {
  return (
    <Container
      className="grid max-w-full grid-flow-row gap-y-6 bg-transparent px-0 pb-0 pt-0"
      rootClassName="bg-transparent"
    >
      <RetryableErrorBoundary>
        <TOMLEditor />
      </RetryableErrorBoundary>
    </Container>
  );
}

TOMLEditorPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <SettingsLayout
      containerProps={{
        className: 'relative',
      }}
    >
      {page}
    </SettingsLayout>
  );
};
