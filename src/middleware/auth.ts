import { RequestHandler } from 'express';
import { getPermissionVariables } from '@/utils';
import { sendError } from '@/errors';
import { ENV } from '../utils/env';
import { gqlSdk } from '@/utils';

export const authMiddleware: RequestHandler = async (req, _, next) => {
  try {
    const permissionVariables = await getPermissionVariables(
      req.headers.authorization
    );
    req.auth = {
      userId: permissionVariables['user-id'],
      defaultRole: permissionVariables['default-role'],
      isAnonymous: permissionVariables['is-anonymous'] === true,
      elevated: permissionVariables['auth-elevated'] === permissionVariables['user-id'],
    };
  } catch (e) {
    req.auth = null;
  }
  next();
};

export const authenticationGate = (
    checkElevatedPermissions: boolean,
    bypassIfNoKeys = false,
): RequestHandler => {
  return async (req, res, next) => {
    if (!req.auth) {
      return sendError(res, 'unauthenticated-user');
    }

    if (checkElevatedPermissions) {
      const auth = req.auth as RequestAuth;
      if (await failsElevatedCheck(auth, bypassIfNoKeys)) {
        return sendError(res, 'elevated-claim-required');
      }
    }

    return next();
  };
}

export const failsElevatedCheck = async (auth: RequestAuth, bypassIfNoKeys = false) => {
  if (ENV.AUTH_REQUIRE_ELEVATED_CLAIM === 'disabled' || !ENV.AUTH_WEBAUTHN_ENABLED || auth.elevated) {
    return false;
  }

  const response = await gqlSdk.getUserSecurityKeys({
    id: auth.userId,
  });

  if (response.authUserSecurityKeys.length === 0 && ENV.AUTH_REQUIRE_ELEVATED_CLAIM === 'recommended') {
    return false;
  }

  if (response.authUserSecurityKeys.length === 0 && bypassIfNoKeys) {
    return false;
  }

  return true;
};
