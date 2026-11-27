import type { Org } from '@/features/orgs/projects/hooks/useOrgs';
import { localOrganization } from '@/features/orgs/utils/local-dashboard';
import resolveLandingOrg from './resolveLandingOrg';

function createOrg(id: string, slug: string, isFree = false): Org {
  return {
    ...localOrganization,
    id,
    slug,
    plan: { ...localOrganization.plan, isFree },
  };
}

const paidOrg = createOrg('11111111-1111-4111-8111-111111111111', 'paid');
const freeOrg = createOrg('22222222-2222-4222-8222-222222222222', 'free', true);
const otherOrg = createOrg('33333333-3333-4333-8333-333333333333', 'other');
const orgs = [paidOrg, freeOrg, otherOrg];

describe('resolveLandingOrg', () => {
  it('prefers the default organization over the last selected one', () => {
    expect(
      resolveLandingOrg({ orgs, defaultOrgId: otherOrg.id, lastSlug: 'paid' }),
    ).toBe(otherOrg);
  });

  it('finds the default organization by ID after its slug changes', () => {
    const renamed = { ...otherOrg, slug: 'renamed' };

    expect(
      resolveLandingOrg({
        orgs: [paidOrg, renamed],
        defaultOrgId: otherOrg.id,
        lastSlug: null,
      }),
    ).toBe(renamed);
  });

  it('falls back to the last selected organization when the default is gone', () => {
    expect(
      resolveLandingOrg({
        orgs,
        defaultOrgId: '44444444-4444-4444-8444-444444444444',
        lastSlug: 'other',
      }),
    ).toBe(otherOrg);
  });

  it('falls back to the first free organization, then the first one', () => {
    expect(
      resolveLandingOrg({ orgs, defaultOrgId: null, lastSlug: 'missing' }),
    ).toBe(freeOrg);
    expect(
      resolveLandingOrg({
        orgs: [paidOrg, otherOrg],
        defaultOrgId: null,
        lastSlug: null,
      }),
    ).toBe(paidOrg);
  });

  it('returns undefined without organizations', () => {
    expect(
      resolveLandingOrg({ orgs: [], defaultOrgId: null, lastSlug: null }),
    ).toBeUndefined();
  });
});
