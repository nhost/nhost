import express, {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import passport, { Profile } from "passport";
import { VerifyCallback } from "passport-oauth2";
import { Strategy } from "passport";

import { APPLICATION, PROVIDERS, REGISTRATION } from "@config/index";
import {
  asyncWrapper,
  getUserById,
  setRefreshToken,
  getGravatarUrl,
  isWhitelistedEmail,
  getUserByEmail,
} from "@/helpers";
import { PermissionVariables, SessionUser } from "@/types";
import {
  ProviderCallbackQuery,
  providerCallbackQuery,
  ProviderQuery,
  providerQuery,
} from "@/validation";
import { v4 as uuidv4 } from "uuid";
import { getClaims, getPermissionVariablesFromClaims } from "@/utils/tokens";
import {
  ContainerTypes,
  createValidator,
  ValidatedRequest,
  ValidatedRequestSchema,
} from "express-joi-validation";
import { UserFieldsFragment } from "@/utils/__generated__/graphql-request";
import { gqlSdk } from "@/utils/gqlSDK";

interface RequestWithState<T extends ValidatedRequestSchema>
  extends ValidatedRequest<T> {
  state: string;
}

interface Constructable<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
  prototype: T;
}

export type TransformProfileFunction = <T extends Profile>(
  profile: T
) => SessionUser;
interface InitProviderSettings {
  transformProfile: TransformProfileFunction;
  callbackMethod: "GET" | "POST";
}

const manageProviderStrategy =
  (provider: string, transformProfile: TransformProfileFunction) =>
  async (
    req: RequestWithState<ProviderCallbackQuerySchema>,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> => {
    req.state = req.query.state as string;

    // TODO How do we handle REGISTRATION_CUSTOM_FIELDS with OAuth?

    // find or create the user
    // check if user exists, using profile.id
    const { id, email, displayName, avatarUrl } = transformProfile(profile);

    if (REGISTRATION.WHITELIST && (!email || !isWhitelistedEmail(email))) {
      return done(new Error("Email not allowed"));
    }

    const user = await gqlSdk
      .providers({
        provider,
        profileId: id,
      })
      .then((res) => res.authProviders[0]?.userProviders);

    // User is already registered
    if (user) {
      return done(null, user);
    }

    if (email) {
      const user = await getUserByEmail(email);

      if (user) {
        const user = await gqlSdk
          .insertProviderToUser({
            userId: id,
            provider: {
              name: provider,
              code: id,
            },
          })
          .then((res) => res.updateUser);

        if (!user) {
          throw new Error("Could not insert provider to user");
        }

        return done(null, user);
      }
    }

    // Check whether logged in user is trying to add a provider
    const jwtToken = await gqlSdk
      .providerRequest({
        id: req.state,
      })
      .then((res) => res.AuthProviderRequest?.jwtToken);

    if (jwtToken) {
      let permissionVariables: PermissionVariables;

      try {
        permissionVariables = getPermissionVariablesFromClaims(
          getClaims(jwtToken)
        );
      } catch (err) {
        return done(new Error("Invalid JWT Token"));
      }

      const id = permissionVariables["user-id"];

      const user = await gqlSdk
        .insertProviderToUser({
          userId: id,
          provider: {
            name: provider,
            code: id,
          },
        })
        .then((res) => res.updateUser);

      if (!user) {
        throw new Error("Could not insert provider to user");
      }

      req.logger.verbose(
        `User ${user.id} added a ${provider} provider(${id})`,
        {
          userId: user.id,
          authProvider: provider,
          authProviderUniqueId: id,
        }
      );

      return done(null, user);
    }

    const insertUser = await gqlSdk
      .insertUser({
        user: {
          email,
          passwordHash: null,
          active: true,
          defaultRole: REGISTRATION.DEFAULT_USER_ROLE,
          roles: {
            data: REGISTRATION.DEFAULT_ALLOWED_USER_ROLES.map((role) => ({
              role,
            })),
          },
          displayName: displayName || email,
          avatarUrl,
          userProviders: {
            data: [
              {
                userProviderCode: provider,
                userProviderUniqueId: id,
              },
            ],
          },
        },
      })
      .then((res) => res.insertUser);

    if (!insertUser) {
      throw new Error("Could not insert user");
    }

    const userId = insertUser.id;

    req.logger.verbose(
      `New user registration with id ${userId}, email ${email} and provider ${provider}(${id})`,
      {
        userId,
        email,
        userProviderCode: provider,
        userProviderUniqueId: id,
      }
    );

    return done(null, insertUser);
  };

const providerCallback = asyncWrapper(
  async (
    req: RequestWithState<ProviderCallbackQuerySchema>,
    res: Response
  ): Promise<void> => {
    // Successful authentication, redirect home.
    // generate tokens and redirect back home

    req.state = req.query.state as string;

    const redirectUrlSuccess = await gqlSdk
      .deleteProviderRequest({
        id: req.state,
      })
      .then((res) => res.deleteAuthProviderRequest?.redirectUrlSuccess);

    const user = req.user as UserFieldsFragment;

    const refreshToken = await setRefreshToken(user.id);

    // redirect back user to app url
    res.redirect(`${redirectUrlSuccess}?refreshToken=${refreshToken}`);
  }
);

export const initProvider = <T extends Strategy>(
  router: Router,
  strategyName:
    | "github"
    | "google"
    | "facebook"
    | "twitter"
    | "linkedin"
    | "apple"
    | "windowslive"
    | "spotify"
    | "gitlab"
    | "bitbucket"
    | "strava",
  strategy: Constructable<T>,
  settings: InitProviderSettings & ConstructorParameters<Constructable<T>>[0], // TODO: Strategy option type is not inferred correctly
  middleware?: RequestHandler
): void => {
  const {
    transformProfile = ({
      id,
      emails,
      displayName,
      photos,
    }: Profile): SessionUser => ({
      id,
      email: emails?.[0].value!,
      displayName: displayName,
      avatarUrl: photos?.[0].value || getGravatarUrl(emails?.[0].value),
    }),
    callbackMethod = "GET",
    scope,
    ...options
  } = settings;

  const subRouter = Router();

  if (middleware) {
    subRouter.use(middleware);
  }

  let registered = false;

  subRouter.use((req, res, next) => {
    if (!registered) {
      passport.use(
        new strategy(
          {
            ...PROVIDERS[strategyName],
            ...options,
            callbackURL: new URL(
              `/providers/${strategyName}/callback`,
              APPLICATION.SERVER_URL
            ).href,
            passReqToCallback: true,
          },
          createValidator().query(providerCallbackQuery),
          manageProviderStrategy(strategyName, transformProfile)
        )
      );

      registered = true;
    }
    next();
  });

  subRouter.get("/", [
    async (req: Request, res: Response, next: NextFunction) => {
      if (REGISTRATION.ADMIN_ONLY) {
        return res.boom.notImplemented(
          "Provider authentication cannot be used when registration when ADMIN_ONLY_REGISTRATION=true"
        );
      }
      await next();
    },
    createValidator().query(providerQuery),
    asyncWrapper(
      async (
        req: RequestWithState<ProviderQuerySchema>,
        res: Response,
        next: NextFunction
      ) => {
        req.state = uuidv4();

        const { redirectUrlSuccess, redirectUrlFailure, jwtToken } = req.query;

        await gqlSdk.insertProviderRequest({
          providerRequest: {
            id: req.state,
            redirectUrlSuccess: redirectUrlSuccess as string,
            redirectUrlFailure: redirectUrlFailure as string,
            jwtToken: jwtToken as string,
          },
        });

        await next();
      }
    ),
    (req: RequestWithState<ProviderQuerySchema>, ...rest: any) => {
      return passport.authenticate(strategyName, {
        session: false,
        state: req.state,
      })(req, ...rest);
    },
    passport.authenticate(strategyName, { session: false, scope }),
  ]);

  const handlers = [
    passport.authenticate(strategyName, {
      failureRedirect: PROVIDERS.REDIRECT_FAILURE,
      session: false,
    }),
    createValidator().query(providerCallbackQuery),
    providerCallback,
  ];
  if (callbackMethod === "POST") {
    // The Sign in with Apple auth provider requires a POST route for authentication
    subRouter.post(
      "/callback",
      express.urlencoded({ extended: true }),
      ...handlers
    );
  } else {
    subRouter.get("/callback", ...handlers);
  }

  router.use(`/${strategyName}`, subRouter);
};

interface ProviderQuerySchema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: ProviderQuery;
}

interface ProviderCallbackQuerySchema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: ProviderCallbackQuery;
}
