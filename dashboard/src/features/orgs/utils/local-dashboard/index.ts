import { type Org } from '@/features/orgs/projects/hooks/useOrgs';
import { ApplicationStatus } from '@/types/application';
import { getHasuraAdminSecret } from '@/utils/env';
import { type GetProjectQuery } from '@/utils/__generated__/graphql';

export const localApplication: GetProjectQuery['apps'][0] = {
  id: '00000000-0000-0000-0000-000000000000',
  slug: 'local',
  name: 'local',
  appStates: [
    {
      id: 'local',
      appId: 'local',
      stateId: ApplicationStatus.Live,
      createdAt: new Date().toISOString(),
    },
  ],
  deployments: [],
  subdomain: 'local',
  region: {
    id: null,
    countryCode: null,
    city: null,
    name: null,
    domain: null,
  },
  createdAt: new Date().toISOString(),
  desiredState: ApplicationStatus.Live,
  featureFlags: [],
  repositoryProductionBranch: null,
  nhostBaseFolder: null,
  legacyPlan: null,
  config: {
    observability: {
      grafana: {
        adminPassword: 'admin',
      },
    },
    hasura: {
      adminSecret: getHasuraAdminSecret(),
    },
  },
};

export const localOrganization: Org = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Local',
  slug: 'local',
  plan: {
    id: 'abc',
    name: 'Pro',
    deprecated: false,
    individual: false,
    isFree: false,
    price: 25,
    featureMaxDbSize: 1,
  },
  apps: [localApplication],
  members: [],
};
