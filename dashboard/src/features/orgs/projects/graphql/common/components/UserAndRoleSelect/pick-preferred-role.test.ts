import { describe, expect, it } from 'vitest';
import pickPreferredRole from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect/pick-preferred-role';

describe('pickPreferredRole', () => {
  it('keeps the admin role for the Admin selection when user is available', () => {
    expect(
      pickPreferredRole('admin', ['admin', 'public', 'anonymous', 'user']),
    ).toBe('admin');
  });

  it('prefers the user role for a real user selection', () => {
    expect(pickPreferredRole('user-id', ['editor', 'user'])).toBe('user');
  });

  it('falls back to the first available role for a real user without user', () => {
    expect(pickPreferredRole('user-id', ['editor', 'viewer'])).toBe('editor');
  });

  it('returns undefined when the selection has no roles', () => {
    expect(pickPreferredRole('user-id', [])).toBeUndefined();
  });
});
