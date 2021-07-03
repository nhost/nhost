import { Response, Router } from "express";

import { asyncWrapper } from "@/helpers";
import { AUTHENTICATION } from "@config/index";
import { Request } from "express";
import { gqlSdk } from "@/utils/gqlSDK";

async function deleteUser(req: Request, res: Response): Promise<unknown> {
  if (!AUTHENTICATION.ALLOW_USER_SELF_DELETE) {
    return res.boom.notImplemented(
      `Please set the ALLOW_USER_SELF_DELETE env variable to true to use the auth/delete route`
    );
  }

  if (!req.auth) {
    return res.boom.unauthorized("Unable to delete user");
  }

  const { userId } = req.auth;

  const user = gqlSdk
    .deleteUser({
      userId,
    })
    .then((res) => res.deleteUser);

  if (!user) {
    throw new Error("Unable to delete user");
  }

  req.logger.verbose(`User ${userId} deleted his user`, {
    userId,
  });

  return res.status(204).send();
}

export default (router: Router) => {
  router.post("/delete", asyncWrapper(deleteUser));
};
