import type { Organization, Project } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import { Organization_Status_Enum } from '@/utils/__generated__/graphql';
import { faker } from '@faker-js/faker';
import type { NhostSession } from '@nhost/nextjs';
import type { NextRouter } from 'next/router';
import { vi } from 'vitest';

export const mockMatchMediaValue = (query: any) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

export const mockRouter: NextRouter = {
  basePath: '',
  pathname: '/orgs/xyz/projects/test-project',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  asPath: '/orgs/xyz/projects/test-project',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
  },
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
  forward: vi.fn(),
};

export const mockApplication: Project = {
  id: '1',
  name: 'Test Project',
  slug: 'test-project',
  appStates: [],
  subdomain: 'test-project',
  region: {
    name: 'us-east-1',
    city: 'New York',
    countryCode: 'US',
    id: '1',
    domain: 'nhost.run',
  },
  createdAt: new Date().toISOString(),
  deployments: [],
  desiredState: ApplicationStatus.Live,
  featureFlags: [],
  githubRepository: { fullName: 'test/git-project' },
  repositoryProductionBranch: null,
  nhostBaseFolder: null,
  legacyPlan: {
    id: '1',
    name: 'Starter',
    isFree: true,
    price: 0,
    featureMaxDbSize: 1,
  },
  config: {
    observability: {
      grafana: {
        adminPassword: 'admin',
      },
    },
    hasura: {
      adminSecret: 'nhost-admin-secret',
    },
  },
};

export const mockSession: NhostSession = {
  accessToken: faker.random.alphaNumeric(),
  accessTokenExpiresIn: 900,
  refreshToken: faker.string.uuid(),
  user: {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    displayName: faker.name.fullName(),
    createdAt: faker.date.past().toISOString(),
    avatarUrl: faker.image.avatar(),
    locale: 'en',
    isAnonymous: false,
    defaultRole: 'user',
    roles: ['user', 'me'],
    metadata: {},
    emailVerified: true,
    phoneNumber: faker.phone.number(),
    phoneNumberVerified: true,
    activeMfaType: 'totp',
  },
};

export const mockOrganization: Organization = {
  id: '93297df9-125e-49df-9db3-94067fa065bd',
  name: 'Test organization',
  slug: 'xyz',
  status: Organization_Status_Enum.Ok,
  plan: {
    id: 'abc',
    name: 'Pro',
    deprecated: false,
    individual: false,
    isFree: false,
    featureMaxDbSize: 1,
    price: 25,
    __typename: 'plans',
  },
  members: [],
  apps: [mockApplication],
  __typename: 'organizations',
};

export const mockOrganizations: Organization[] = [
  {
    id: 'org-1',
    name: "User's Personal Organization",
    slug: 'ynrnjteywyxjhlmgzgif',
    status: Organization_Status_Enum.Ok,
    plan: {
      id: 'starter',
      name: 'Starter',
      price: 0,
      deprecated: false,
      individual: true,
      isFree: true,
      featureMaxDbSize: 1,
      __typename: 'plans',
    },
    apps: [],
    members: [],
    __typename: 'organizations',
  },
  {
    id: 'org-2',
    name: 'Second First Try',
    slug: 'kbdoxvsoisppkrwzjhwl',
    status: Organization_Status_Enum.Ok,
    plan: {
      id: 'pro',
      name: 'Pro',
      price: 25,
      deprecated: false,
      individual: false,
      isFree: false,
      featureMaxDbSize: 10,
      __typename: 'plans',
    },
    apps: [],
    members: [],
    __typename: 'organizations',
  },
];

export const newOrg: Organization = {
  ...mockOrganization,
  id: 'newOrg',
  name: 'New Org',
  slug: 'new-org',
};

export const mockOrganizationsWithNewOrg: Organization[] = [
  ...mockOrganizations,
  newOrg,
];

export const fetchPiTRBaseBackups = async () => ({
  data: {
    getPiTRBaseBackups: [
      {
        date: '2025-03-11T03:00:05Z',
        name: 'base_00000001000000000000004C',
        __typename: 'PiTRBaseBackup',
      },
      {
        date: '2025-03-10T03:00:05Z',
        name: 'base_000000010000000000000047',
        __typename: 'PiTRBaseBackup',
      },
    ],
  },
});

export const fetchEmptyPiTRBaseBackups = async () => ({
  data: {
    getPiTRBaseBackups: [],
  },
});
