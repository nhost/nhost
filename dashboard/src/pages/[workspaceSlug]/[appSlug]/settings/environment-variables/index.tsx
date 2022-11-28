import Container from '@/components/layout/Container';
import EnvironmentVariableSettings from '@/components/settings/environmentVariables/EnvironmentVariableSettings';
import SystemEnvironmentVariableSettings from '@/components/settings/environmentVariables/SystemEnvironmentVariableSettings';
import SettingsLayout from '@/components/settings/SettingsLayout';
import type { ReactElement } from 'react';

export default function EnvironmentVariablesPage() {
  return (
    <Container
      className="grid grid-flow-row gap-6 max-w-5xl bg-transparent"
      rootClassName="bg-transparent"
    >
      <EnvironmentVariableSettings />
      <SystemEnvironmentVariableSettings />
    </Container>
  );
}

EnvironmentVariablesPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
