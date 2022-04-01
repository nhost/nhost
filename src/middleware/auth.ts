import { RequestHandler } from 'express';
import { getPermissionVariables } from '@/utils';
import { sendError } from '@/errors';

export const authMiddleware: RequestHandler = async (req, _, next) => {
  try {
    const permissionVariables = getPermissionVariables(
      req.headers.authorization
    );
    req.auth = {
      userId: permissionVariables['user-id'],
      defaultRole: permissionVariables['default-role'],
      isAnonymous: permissionVariables['is-anonymous'] === true,
    };
  } catch (e) {
    req.auth = null;
  }
  next();
};

export const authenticationGate: RequestHandler = (req, res, next) => {
  if (!req.auth) {
    return sendError(res, 'unauthenticated-user');
  } else {
    next();
  }
};
