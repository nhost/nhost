import { Request, Response, NextFunction } from "express";
import { getClaims, getPermissionVariablesFromClaims } from "@/utils/tokens";
import { gqlSdk } from "@/utils/gqlSDK";

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

  console.log("permission variables in auth middleware");
  console.log(permissionVariables);

  if (permissionVariables) {
    req.auth = {
      userId: permissionVariables["user-id"],
      defaultRole: permissionVariables["default-role"],
    };
  }

  if ("refreshToken" in req.query) {
    // req.logger.debug(`Request with refresh token ${req.refreshToken}`, {
    //   refreshToken: req.refreshToken,
    // });

    req.refreshToken = req.query.refreshToken as string;

    // TODO: We do this query almost every time
    // in the routes too. Maybe attach `user` to `req`?
    const user = await gqlSdk
      .getUsersByRefreshToken({
        refreshToken: req.refreshToken,
      })
      .then((res) => res.authRefreshTokens[0]?.user);

    if (!user) {
      return res.boom.unauthorized("Invalid or expired refresh token");
    }
  }

  next();
};
