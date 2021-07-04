import { Response, Router } from "express";
import { asyncWrapper } from "@/helpers";
import { LogoutSchema, logoutSchema } from "@/validation";
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest,
} from "express-joi-validation";
import { gqlSdk } from "@/utils/gqlSDK";

async function logout(
  { body, refreshToken }: ValidatedRequest<Schema>,
  res: Response
) {
  if (!refreshToken) {
    return res.boom.unauthorized("Invalid or expired refresh token");
  }

  // should we delete all refresh tokens to this user or not
  const { all } = body;

  if (all) {
    // get user based on refresh token
    const user = await gqlSdk
      .usersByRefreshToken({
        refreshToken,
      })
      .then((res) => res.authRefreshTokens[0].user);

    // delete all refresh tokens for user
    await gqlSdk.deleteUserRefreshTokens({
      userId: user.id,
    });
  } else {
    // if only to delete single refresh token
    await gqlSdk.deleteRefreshToken({
      id: refreshToken,
    });
  }

  return res.status(204).send();
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: LogoutSchema;
}

export default (router: Router) => {
  router.post(
    "/logout",
    createValidator().body(logoutSchema),
    asyncWrapper(logout)
  );
};
