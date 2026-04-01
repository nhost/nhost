import { getPermissionState } from './getPermissionState';

describe('getPermissionState', () => {
  describe('when inferFunctionPermissions is true and function is not a mutation (inferred path)', () => {
    it('returns allowed when role has SELECT permission', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: true,
          isMutationFunction: false,
          hasSelectPermission: true,
          hasFunctionPermission: true,
        }),
      ).toBe('allowed');
    });

    it('returns not-allowed when role lacks SELECT permission', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: true,
          isMutationFunction: false,
          hasSelectPermission: false,
          hasFunctionPermission: true,
        }),
      ).toBe('not-allowed');
    });

    it('ignores hasFunctionPermission (SELECT alone grants access)', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: true,
          isMutationFunction: false,
          hasSelectPermission: true,
          hasFunctionPermission: false,
        }),
      ).toBe('allowed');
    });
  });

  describe('when on the explicit permission path', () => {
    it('returns allowed when role has both function permission and SELECT', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: false,
          isMutationFunction: false,
          hasFunctionPermission: true,
          hasSelectPermission: true,
        }),
      ).toBe('allowed');
    });

    it('returns partial when role has function permission but no SELECT', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: false,
          isMutationFunction: false,
          hasFunctionPermission: true,
          hasSelectPermission: false,
        }),
      ).toBe('partial');
    });

    it('returns not-allowed when role lacks function permission despite having SELECT', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: false,
          isMutationFunction: false,
          hasFunctionPermission: false,
          hasSelectPermission: true,
        }),
      ).toBe('not-allowed');
    });

    it('returns not-allowed when role has neither function permission nor SELECT', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: false,
          isMutationFunction: false,
          hasFunctionPermission: false,
          hasSelectPermission: false,
        }),
      ).toBe('not-allowed');
    });
  });

  describe('mutation functions bypass inference', () => {
    it('falls through to explicit path even when inferFunctionPermissions is true', () => {
      expect(
        getPermissionState({
          inferFunctionPermissions: true,
          isMutationFunction: true,
          hasSelectPermission: true,
          hasFunctionPermission: false,
        }),
      ).toBe('not-allowed');
    });
  });
});
