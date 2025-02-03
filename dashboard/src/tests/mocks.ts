import type { Organization, Project, Workspace } from '@/types/application';
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
  pathname: '/test-workspace/test-application',
  route: '/[workspaceSlug]/[appSlug]',
  asPath: '/test-workspace/test-application',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {
    workspaceSlug: 'test-workspace',
    appSlug: 'test-application',
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
  name: 'Test Application',
  slug: 'test-application',
  appStates: [],
  subdomain: '',
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

export const mockWorkspace: Workspace = {
  id: '1',
  name: 'Test Workspace',
  slug: 'test-workspace',
  workspaceMembers: [],
  projects: [mockApplication],
  creatorUserId: '1',
};

export const mockSession: NhostSession = {
  accessToken: faker.random.alphaNumeric(),
  accessTokenExpiresIn: 900,
  refreshToken: faker.datatype.uuid(),
  user: {
    id: faker.datatype.uuid(),
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
  apps: [
    {
      id: '1',
      name: 'Test Application',
      subdomain: '',
      slug: 'test-application',
      __typename: 'apps',
    },
  ],
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
