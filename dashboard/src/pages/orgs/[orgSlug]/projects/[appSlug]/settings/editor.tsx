import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';
import type { ReactElement } from 'react';

export default function TOMLEditorPage() {
  return <TOMLEditor />;
}

TOMLEditorPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
