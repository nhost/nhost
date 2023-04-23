import type { Project, Workspace } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import { faker } from '@faker-js/faker';
import type { NhostSession } from '@nhost/nextjs';
import type { NextRouter } from 'next/router';
import { vi } from 'vitest';

export const mockRouter: NextRouter = {
  basePath: '',
  pathname: '/test-workspace/test-application',
  route: '/[workspaceSlug]/[appSlug]',
  asPath: '/test-workspace/test-application',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {},
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
};

export const mockApplication: Project = {
  id: '1',
  name: 'Test Application',
  slug: 'test-application',
  appStates: [],
  subdomain: '',
  isProvisioned: true,
  region: {
    awsName: 'us-east-1',
    city: 'New York',
    countryCode: 'US',
    id: '1',
  },
  createdAt: new Date().toISOString(),
  deployments: [],
  desiredState: ApplicationStatus.Live,
  featureFlags: [],
  providersUpdated: true,
  githubRepository: { fullName: 'test/git-project' },
  repositoryProductionBranch: null,
  nhostBaseFolder: null,
  plan: {
    id: '1',
    name: 'Starter',
    isFree: true,
    price: 0,
  },
  config: {
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
