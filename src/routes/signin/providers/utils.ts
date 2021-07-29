import express, {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from 'express';
import passport, { Profile } from 'passport';
import { VerifyCallback } from 'passport-oauth2';
import { Strategy } from 'passport';

import { APPLICATION, PROVIDERS, REGISTRATION } from '@config/index';
import {
  asyncWrapper,
  getGravatarUrl,
  isWhitelistedEmail,
  getUserByEmail,
} from '@/helpers';
import { PermissionVariables, SessionUser } from '@/types';
import {
  ProviderCallbackQuery,
  providerCallbackQuery,
  ProviderQuery,
  providerQuery,
} from '@/validation';
import { v4 as uuidv4 } from 'uuid';
import {
  getClaims,
  getNewRefreshToken,
  getPermissionVariablesFromClaims,
} from '@/utils/tokens';
import {
  ContainerTypes,
  createValidator,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { UserFieldsFragment } from '@/utils/__generated__/graphql-request';
import { gqlSdk } from '@/utils/gqlSDK';

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
  callbackMethod: 'GET' | 'POST';
}

const manageProviderStrategy =
  (provider: string, transformProfile: TransformProfileFunction) =>
  async (
    req: RequestWithState<ProviderCallbackQuerySchema>,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> => {
    console.log('manage provider strategy');

    req.state = req.query.state as string;

    // TODO How do we handle REGISTRATION_CUSTOM_FIELDS with OAuth?

    // find or create the user
    // check if user exists, using profile.id
    const { id, email, displayName, avatarUrl } = transformProfile(profile);

    if (REGISTRATION.WHITELIST && (!email || !isWhitelistedEmail(email))) {
      return done(new Error('Email not allowed'));
    }

    console.log('id');
    console.log(id);
    console.log('email');
    console.log(email);
    console.log('displayName');
    console.log(displayName);
    console.log('avatarUrl');
    console.log(avatarUrl);

    // check if user already exist with `id` (unique id from provider)
    const userProvider = await gqlSdk
      .authUserProviders({
        provider,
        providerUserId: id.toString(),
      })
      .then((res) => {
        console.log(res);

        return res.authUserProviders[0];
      });

    // User is already registered
    if (userProvider) {
      return done(null, userProvider.user);
    }

    if (email) {
      const user = await getUserByEmail(email);

      if (user) {
        // add this provider to existing user with the same email
        const insertedUser = await gqlSdk
          .insertUserProviderToUser({
            userId: user.id,
            userProvider: {
              userId: user.id,
              providerId: provider,
              providerUserId: id.toString(),
              accessToken,
              refreshToken,
            },
          })
          .then((res) => res.updateUser);

        if (!insertedUser) {
          throw new Error('Could not insert provider to user');
        }

        return done(null, user);
      }
    }

    // // Check whether logged in user is trying to add a provider
    // const jwtToken = await gqlSdk
    //   .providerRequest({
    //     id: req.state,
    //   })
    //   .then((res) => res.AuthProviderRequest?.jwtToken);

    // if (jwtToken) {
    //   let permissionVariables: PermissionVariables;

    //   try {
    //     permissionVariables = getPermissionVariablesFromClaims(
    //       getClaims(jwtToken)
    //     );
    //   } catch (err) {
    //     return done(new Error("Invalid JWT Token"));
    //   }

    //   const id = permissionVariables["user-id"];

    //   const user = await gqlSdk
    //     .insertProviderToUser({
    //       userId: id,
    //       provider: {
    //         id,
    //       },
    //     })
    //     .then((res) => res.updateUser);

    //   if (!user) {
    //     throw new Error("Could not insert provider to user");
    //   }

    //   req.logger.verbose(
    //     `User ${user.id} added a ${provider} provider(${id})`,
    //     {
    //       userId: user.id,
    //       authProvider: provider,
    //       authProviderUniqueId: id,
    //     }
    //   );

    //   return done(null, user);
    // }

    const insertUser = await gqlSdk
      .insertUser({
        user: {
          email,
          passwordHash: null,
          isActive: true,
          emailVerified: true,
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
                providerUserId: id.toString(),
                accessToken,
                refreshToken,
                providerId: provider,
              },
            ],
          },
        },
      })
      .then((res) => res.insertUser);

    if (!insertUser) {
      throw new Error('Could not insert user');
    }

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

    const redirectUrl = await gqlSdk
      .deleteProviderRequest({
        id: req.state,
      })
      .then((res) => res.deleteAuthProviderRequest?.redirectUrl);

    const user = req.user as UserFieldsFragment;

    const refreshToken = await getNewRefreshToken(user.id);

    // redirect back user to app url
    res.redirect(`${redirectUrl}#refreshToken=${refreshToken}`);
  }
);

export const initProvider = <T extends Strategy>(
  router: Router,
  strategyName:
    | 'github'
    | 'google'
    | 'facebook'
    | 'twitter'
    | 'linkedin'
    | 'apple'
    | 'windowslive'
    | 'spotify'
    | 'gitlab'
    | 'bitbucket'
    | 'strava',
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
      email: emails?.[0].value,
      displayName: displayName,
      avatarUrl: photos?.[0].value || getGravatarUrl(emails?.[0].value),
    }),
    callbackMethod = 'GET',
    ...options
  } = settings;

  const subRouter = Router();

  console.log('strategy name:');
  console.log(strategyName);

  console.log({ middleware });

  if (middleware) {
    console.log('middleware exist');
    subRouter.use(middleware);
  }

  console.log('registered = false');

  let registered = false;

  subRouter.use((req, res, next) => {
    if (!registered) {
      passport.use(
        new strategy(
          {
            ...PROVIDERS[strategyName],
            ...options,
            callbackURL: `${APPLICATION.SERVER_URL}/signin/provider/${strategyName}/callback`,
            passReqToCallback: true,
          },
          manageProviderStrategy(strategyName, transformProfile)
        )
      );

      registered = true;
    }

    console.log('next function after passport use new..');
    next();
  });

  subRouter.get('/', [
    async (req: Request, res: Response, next: NextFunction) => {
      console.log('in second sub route');

      if (REGISTRATION.ADMIN_ONLY) {
        return res.boom.notImplemented(
          'Provider authentication cannot be used when registration when ADMIN_ONLY_REGISTRATION=true'
        );
      }
      console.log('next function 2');
      await next();
    },
    createValidator().query(providerQuery),
    asyncWrapper(
      async (
        req: RequestWithState<ProviderQuerySchema>,
        res: Response,
        next: NextFunction
      ) => {
        console.log(' req uuidv4');

        req.state = uuidv4();

        // get redirect Url
        // will default to REDIRECT_URL_SUCCESS
        const redirectUrl = req.query.redirectUrl as string;

        // TODO:
        // - make sure redirect url is in allowed redirect urls
        // - rename REDIRECT_URL_SUCCESS to REDIRECT_URL
        // - place all env vars under `ENV`

        console.log('insert provider request');

        await gqlSdk.insertProviderRequest({
          providerRequest: {
            id: req.state,
            redirectUrl,
          },
        });

        console.log('next function 3');
        await next();
      }
    ),
    (req: RequestWithState<ProviderQuerySchema>, ...rest: any) => {
      return passport.authenticate(strategyName, {
        session: false,
        state: req.state,
      })(req, ...rest);
    },
  ]);

  const handlers = [
    passport.authenticate(strategyName, {
      session: false,
    }),
    createValidator().query(providerCallbackQuery),
    providerCallback,
  ];

  if (callbackMethod === 'POST') {
    // The Sign in with Apple auth provider requires a POST route for authentication
    subRouter.post(
      '/callback',
      express.urlencoded({ extended: true }),
      ...handlers
    );
  } else {
    subRouter.get('/callback', ...handlers);
  }

  subRouter.stack.forEach(function (r) {
    if (r.route && r.route.path) {
      console.log(r.route.path);
    }
  });

  router.use(`/${strategyName}`, subRouter);
};

interface ProviderQuerySchema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: ProviderQuery;
}

interface ProviderCallbackQuerySchema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: ProviderCallbackQuery;
}
