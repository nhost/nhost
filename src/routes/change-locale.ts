import { Response, Router } from "express";
import { asyncWrapper } from "@/helpers";
import { localeSchema, LocaleSchema } from "@/validation";
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest,
} from "express-joi-validation";
import { gqlSdk } from "@/utils/gqlSDK";

async function changeLocale(
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> {
  if (!req.auth) {
    return res.boom.unauthorized("Not logged in");
  }

  const { locale } = req.body;
  const { userId } = req.auth;

  await gqlSdk.updateUser({
    id: userId,
    user: {
      locale,
    },
  });

  req.logger.verbose(`User ${userId} changed his locale to ${locale}`, {
    userId,
    locale,
  });

  return res.status(204).send();
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: LocaleSchema;
}

export default (router: Router) => {
  router.post(
    "/change-locale",
    createValidator().body(localeSchema),
    asyncWrapper(changeLocale)
  );
};
