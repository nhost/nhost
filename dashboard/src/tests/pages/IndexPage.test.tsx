import { vi } from 'vitest';
import { getDefaultOrganizationStorageKey } from '@/features/orgs/hooks/useDefaultOrganization';
import type { Org } from '@/features/orgs/projects/hooks/useOrgs';
import { localOrganization } from '@/features/orgs/utils/local-dashboard';
import IndexPage from '@/pages/index';
import { render, waitFor } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useAuth: vi.fn(),
  useIsPlatform: vi.fn(),
  useOrgs: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({ push: mocks.push, query: {} }),
}));

vi.mock('@/providers/Auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/providers/Auth')>()),
  useAuth: mocks.useAuth,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: mocks.useOrgs,
}));

const USER_ID = 'user-1';
const STORAGE_KEY = getDefaultOrganizationStorageKey(USER_ID);

function createOrg(id: string, slug: string): Org {
  return { ...localOrganization, id, slug };
}

const acme = createOrg('11111111-1111-4111-8111-111111111111', 'acme');
const globex = createOrg('22222222-2222-4222-8222-222222222222', 'globex');

function renderWithOrgs(orgs: Org[]) {
  mocks.useOrgs.mockReturnValue({
    orgs,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  render(<IndexPage />);
}

describe('IndexPage default organization', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.push.mockReset();
    mocks.useIsPlatform.mockReturnValue(true);
    mocks.useAuth.mockReturnValue({
      user: { id: USER_ID },
      isAuthenticated: true,
      isLoading: false,
      isSigningOut: false,
    });
  });

  it('opens the default organization instead of the last selected one', async () => {
    localStorage.setItem(STORAGE_KEY, globex.id);
    localStorage.setItem('slug', JSON.stringify('acme'));

    renderWithOrgs([acme, globex]);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/orgs/globex/projects'),
    );
    expect(mocks.push).not.toHaveBeenCalledWith('/orgs/acme/projects');
  });

  it('opens the last selected organization when no default is set', async () => {
    localStorage.setItem('slug', JSON.stringify('globex'));

    renderWithOrgs([acme, globex]);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/orgs/globex/projects'),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('saves the only organization as the default', async () => {
    renderWithOrgs([acme]);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/orgs/acme/projects'),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(acme.id);
  });

  it('sends users without organizations to onboarding', async () => {
    renderWithOrgs([]);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding'));
  });
});
