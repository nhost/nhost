import { vi } from 'vitest';
import { getDefaultOrganizationStorageKey } from '@/features/orgs/hooks/useDefaultOrganization';
import type { Org } from '@/features/orgs/projects/hooks/useOrgs';
import { localOrganization } from '@/features/orgs/utils/local-dashboard';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import DefaultOrganizationSettings from './DefaultOrganizationSettings';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useIsPlatform: vi.fn(),
  useOrgs: vi.fn(),
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

function createOrg(id: string, name: string): Org {
  return { ...localOrganization, id, name, slug: name.toLowerCase() };
}

const acme = createOrg('11111111-1111-4111-8111-111111111111', 'Acme');
const globex = createOrg('22222222-2222-4222-8222-222222222222', 'Globex');

function setup({
  orgs = [acme, globex],
  currentOrg = acme,
  loading = false,
  error = null,
}: {
  orgs?: Org[];
  currentOrg?: Org;
  loading?: boolean;
  error?: Error | null;
} = {}) {
  mocks.useOrgs.mockReturnValue({ orgs, currentOrg, loading, error });
  render(<DefaultOrganizationSettings />);
}

function getSwitch(org: Org) {
  return screen.getByRole('switch', { name: `Set ${org.name} as default` });
}

describe('DefaultOrganizationSettings', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(mockMatchMediaValue),
    });
  });

  beforeEach(() => {
    localStorage.clear();
    mocks.useIsPlatform.mockReturnValue(true);
    mocks.useAuth.mockReturnValue({ user: { id: USER_ID } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hidden', () => {
    it('in self hosted mode', () => {
      mocks.useIsPlatform.mockReturnValue(false);
      setup();

      expect(
        screen.queryByText('Default organization'),
      ).not.toBeInTheDocument();
    });

    it('while organizations load', () => {
      setup({ loading: true });

      expect(
        screen.queryByText('Default organization'),
      ).not.toBeInTheDocument();
    });

    it('when organizations fail to load', () => {
      setup({ error: new Error('boom') });

      expect(
        screen.queryByText('Default organization'),
      ).not.toBeInTheDocument();
    });
  });

  it('lists every organization with its own switch', () => {
    setup();

    expect(getSwitch(acme)).toBeInTheDocument();
    expect(getSwitch(globex)).toBeInTheDocument();
  });

  it('marks the organization you are in', () => {
    setup({ currentOrg: globex });

    expect(screen.getAllByText("You're here")).toHaveLength(1);
    expect(getSwitch(globex).closest('tr')).toHaveTextContent("You're here");
  });

  it('shows the only organization as the default, locked on', () => {
    setup({ orgs: [acme] });

    expect(getSwitch(acme)).toBeChecked();
    expect(getSwitch(acme)).toBeDisabled();
    expect(
      screen.getByText('Your only organization is always your default.'),
    ).toBeInTheDocument();
  });

  it('says when no default is set', () => {
    setup();

    expect(getSwitch(acme)).not.toBeChecked();
    expect(getSwitch(globex)).not.toBeChecked();
    expect(screen.getByText(/No default is set/)).toBeInTheDocument();
  });

  it('treats a default the user no longer belongs to as no default', () => {
    localStorage.setItem(STORAGE_KEY, '33333333-3333-4333-8333-333333333333');
    setup();

    expect(screen.getByText(/No default is set/)).toBeInTheDocument();
  });

  it('turns on the stored default, even from another organization page', () => {
    localStorage.setItem(STORAGE_KEY, globex.id);
    setup({ currentOrg: acme });

    expect(getSwitch(globex)).toBeChecked();
    expect(getSwitch(acme)).not.toBeChecked();
    expect(screen.queryByText(/No default is set/)).not.toBeInTheDocument();
  });

  it('sets a default', async () => {
    const user = new TestUserEvent();
    setup();

    await user.click(getSwitch(globex));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(globex.id);
    expect(getSwitch(globex)).toBeChecked();
  });

  it('moves the default when another organization is turned on', async () => {
    const user = new TestUserEvent();
    localStorage.setItem(STORAGE_KEY, globex.id);
    setup();

    await user.click(getSwitch(acme));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(acme.id);
    expect(getSwitch(acme)).toBeChecked();
    expect(getSwitch(globex)).not.toBeChecked();
  });

  it('clears the default when it is turned off', async () => {
    const user = new TestUserEvent();
    localStorage.setItem(STORAGE_KEY, globex.id);
    setup();

    await user.click(getSwitch(globex));

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getSwitch(globex)).not.toBeChecked();
  });

  it('keeps the current default when saving fails', async () => {
    const user = new TestUserEvent();
    localStorage.setItem(STORAGE_KEY, globex.id);
    setup();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await user.click(getSwitch(acme));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(globex.id);
    expect(getSwitch(globex)).toBeChecked();
    expect(getSwitch(acme)).not.toBeChecked();
  });
});
