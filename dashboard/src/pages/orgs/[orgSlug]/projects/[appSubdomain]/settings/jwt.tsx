import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  useGetCustomClaimsQuery,
  useGetJwtSecretsQuery,
} from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { JWTSettings } from '@/features/orgs/projects/jwt/settings/components/JWTSettings';

export default function SettingsJWTPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const {
    data: customClaimsData,
    loading: customClaimsLoading,
    error: customClaimsError,
  } = useGetCustomClaimsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    data: jwtSecretsData,
    loading: jwtSecretsLoading,
    error: jwtSecretsError,
  } = useGetJwtSecretsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (
    customClaimsLoading ||
    jwtSecretsLoading ||
    !jwtSecretsData ||
    !customClaimsData
  ) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading JWT settings..."
        className="justify-center"
      />
    );
  }

  if (customClaimsError || jwtSecretsError) {
    throw new Error('Failed to load JWT settings', {
      cause: { customClaimsError, jwtSecretsError },
    });
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <JWTSettings />
    </Container>
  );
}

SettingsJWTPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout>
      <SettingsLayout>
        <Container
          sx={{ backgroundColor: 'background.default' }}
          className="max-w-5xl"
        >
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
