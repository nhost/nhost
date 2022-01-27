import { Request, Response, NextFunction } from 'express';
import { getClaims, getPermissionVariablesFromClaims } from '@/utils/jwt';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let permissionVariables = null;
  try {
    permissionVariables = getPermissionVariablesFromClaims(
      getClaims(req.headers.authorization)
    );
  } catch (e) {
    // noop
  }

  req.auth = null;

  if (permissionVariables) {
    req.auth = {
      userId: permissionVariables['user-id'],
      defaultRole: permissionVariables['default-role'],
      isAnonymous: permissionVariables['is-anonymous'] === true,
    };
  }

  next();
};
