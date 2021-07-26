import {
  AUTHENTICATION,
  APPLICATION,
  REGISTRATION,
  HEADERS,
} from "@config/index";
import { NextFunction, Response, Router } from "express";
import {
  asyncWrapper,
  isCompromisedPassword,
  hashPassword,
  setRefreshToken,
  getGravatarUrl,
  isWhitelistedEmail,
  getUserByEmail,
} from "@/helpers";
import { newJwtExpiry, createHasuraJwtToken } from "@/jwt";
import { emailClient } from "@/email";
import {
  isMagicLinkLogin,
  isMagicLinkRegister,
  isRegularRegister,
  RegisterSchema,
  registerSchema,
} from "@/validation";
import { v4 as uuidv4 } from "uuid";
import { Session } from "@/types";
import {
  ValidatedRequest,
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
} from "express-joi-validation";
import { gqlSdk } from "@/utils/gqlSDK";

async function registerAccount(
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> {
  const body = req.body;

  if (REGISTRATION.ADMIN_ONLY) {
    const adminSecret = req.headers[HEADERS.ADMIN_SECRET_HEADER];

    if (adminSecret !== APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET) {
      return res.boom.unauthorized("Invalid x-admin-secret");
    }
  }

  const { email, locale } = body;

  if (REGISTRATION.WHITELIST && !(await isWhitelistedEmail(email))) {
    return res.boom.unauthorized("Email not allowed");
  }

  const userAlreadyExist = await getUserByEmail(body.email).catch(() => {
    return null;
  });

  if (userAlreadyExist) {
    return res.boom.badRequest("Email already in use");
  }

  let passwordHash: string | null = null;

  const ticket = uuidv4();
  // Ticket expires after 60 min
  const ticketExpiresAt = new Date(+new Date() + 60 * 60 * 1000).toISOString();

  if (isRegularRegister(body)) {
    if (await isCompromisedPassword(body.password)) {
      return res.boom.badRequest("Password is too weak");
    }

    passwordHash = await hashPassword(body.password);
  }

  const defaultRole = body.defaultRole ?? REGISTRATION.DEFAULT_USER_ROLE;
  const allowedRoles =
    body.allowedRoles ?? REGISTRATION.DEFAULT_ALLOWED_USER_ROLES;

  // check if default role is part of allowedRoles
  if (!allowedRoles.includes(defaultRole)) {
    req.logger.verbose(
      `User tried registering with email ${email} but used an invalid default role ${defaultRole}`,
      {
        email,
        defaultRole: defaultRole,
        allowedRoles: allowedRoles,
      }
    );
    return res.boom.badRequest("Default role must be part of allowed roles");
  }

  // check if allowed roles is a subset of allowedRoles
  if (
    !allowedRoles.every((role: string) =>
      REGISTRATION.ALLOWED_USER_ROLES.includes(role)
    )
  ) {
    req.logger.verbose(
      `User tried registering with email ${email} but used an invalid role`,
      {
        email,
        allowedRoles: allowedRoles,
        appAllowedRoles: REGISTRATION.ALLOWED_USER_ROLES,
      }
    );
    return res.boom.badRequest(
      "Allowed roles must be a subset of allowedRoles"
    );
  }

  const userRoles = allowedRoles.map((role: string) => ({ role }));

  // todo allow to set displayName on register
  const displayName = email;
  const avatarUrl = getGravatarUrl(email);

  const user = await gqlSdk
    .insertUser({
      user: {
        displayName,
        avatarUrl,
        email,
        passwordHash,
        ticket,
        ticketExpiresAt,
        active: REGISTRATION.AUTO_ACTIVATE_NEW_USERS,
        locale,
        defaultRole,
        customRegisterData: body.customRegisterData,
        roles: {
          data: userRoles,
        },
      },
    })
    .then((res) => res.insertUser);

  if (!user) {
    throw new Error("Unable to insert new user");
  }

  // create session user
  const sessionUser = {
    id: user.id,
    email: user.email,
    displayName: displayName,
    avatarUrl: user.avatarUrl || "",
  };

  if (!REGISTRATION.AUTO_ACTIVATE_NEW_USERS && AUTHENTICATION.VERIFY_EMAILS) {
    if (!APPLICATION.EMAILS_ENABLED) {
      throw new Error("SMTP settings unavailable");
    }

    // use display name from body
    const displayName = body.customRegisterData?.displayName || email;

    if (isMagicLinkLogin(body)) {
      await emailClient.send({
        template: "magic-link",
        message: {
          to: user.email,
          headers: {
            "x-ticket": {
              prepared: true,
              value: ticket,
            },
          },
        },
        locals: {
          displayName,
          token: ticket,
          url: APPLICATION.SERVER_URL,
          locale: user.locale,
          appUrl: APPLICATION.APP_URL,
          action: "register",
          actionUrl: "register",
        },
      });

      req.logger.verbose(
        `New magic link user registration with id ${user.id} and email ${email}`,
        {
          userId: user.id,
          email,
        }
      );

      return res.send({ user: sessionUser });
    }

    await emailClient.send({
      template: "activate-user",
      message: {
        to: email,
        headers: {
          "x-ticket": {
            prepared: true,
            value: ticket,
          },
        },
      },
      locals: {
        displayName,
        ticket,
        url: APPLICATION.SERVER_URL,
        locale: user.locale,
      },
    });

    req.logger.verbose(
      `New user registration with id ${user.id} and email ${email}`,
      {
        userId: user.id,
        email,
      }
    );

    return res.send({ user: sessionUser });
  }

  // continue here if auto activate users

  const refreshToken = await setRefreshToken(user.id);

  // generate JWT
  const jwtToken = createHasuraJwtToken(user);
  const jwtExpiresIn = newJwtExpiry;

  const session: Session = {
    jwtToken,
    jwtExpiresIn,
    user: sessionUser,
    refreshToken,
  };

  return res.send(session);
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: RegisterSchema;
}

export default (router: Router) => {
  router.post(
    "/register",
    createValidator().body(registerSchema),
    (req: ValidatedRequest<Schema>, res: Response, next: NextFunction) => {
      if (isMagicLinkRegister(req.body) && !AUTHENTICATION.MAGIC_LINK_ENABLED) {
        return res.boom.badRequest("Magic link registration is disabled");
      } else {
        return next();
      }
    },
    asyncWrapper(registerAccount)
  );
};
