import { Response } from "express";
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from "express-joi-validation";
import { v4 as uuidv4 } from "uuid";

import { REGISTRATION } from "@config/registration";
import {
  getGravatarUrl,
  getUserByEmail,
  hashPassword,
  isWhitelistedEmail,
} from "@/helpers";
import { pwnedPassword } from "hibp";
import { gqlSdk } from "@/utils/gqlSDK";
import { AUTHENTICATION } from "@config/authentication";
import { APPLICATION } from "@config/application";
import { emailClient } from "@/email";
import { insertProfile } from "@/utils/profile";

type Profile = {
  [key: string]: string | number | boolean;
};

type BodyType = {
  email: string;
  password: string;
  locale: string;
  allowedRoles: string[];
  defaultRole: string;
  displayName: string;
  profile: Profile | null;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signUpEmailPasswordHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log("sign up email password handler");

  const { body } = req;
  const { email, password, profile, locale } = body;

  // Check if whitelisting is enabled and if email is whitelisted
  if (REGISTRATION.WHITELIST && !(await isWhitelistedEmail(email))) {
    return res.boom.unauthorized("Email not allowed");
  }

  // check if email already in use by some other user
  const userAlreadyExist = await getUserByEmail(email);

  if (userAlreadyExist) {
    return res.boom.badRequest("Email already in use");
  }

  // check if password is compromised
  if (REGISTRATION.HIBP_ENABLED && (await pwnedPassword(password))) {
    return res.boom.badRequest("Password is too weak");
  }

  // set default role
  const defaultRole = body.defaultRole ?? REGISTRATION.DEFAULT_USER_ROLE;

  // set allowed roles
  const allowedRoles =
    body.allowedRoles ?? REGISTRATION.DEFAULT_ALLOWED_USER_ROLES;

  // check if default role is part of allowedRoles
  if (!allowedRoles.includes(defaultRole)) {
    return res.boom.badRequest("Default role must be part of allowed roles");
  }

  // check if allowedRoles is a subset of allowed user roles
  if (
    !allowedRoles.every((role: string) =>
      REGISTRATION.ALLOWED_USER_ROLES.includes(role)
    )
  ) {
    return res.boom.badRequest(
      "Allowed roles must be a subset of allowedRoles"
    );
  }

  // hash password
  const passwordHash = await hashPassword(password);

  // ticket
  const ticket = `userActivate:${uuidv4()}`;
  const ticketExpiresAt = new Date(+new Date() + 60 * 60 * 1000).toISOString();

  // restructure user roles to be inserted in GraphQL mutation
  const userRoles = allowedRoles.map((role: string) => ({ role }));

  const displayName = body.displayName ?? email;
  const avatarUrl = getGravatarUrl(email);

  // insert user
  const user = await gqlSdk
    .insertUser({
      user: {
        displayName,
        avatarUrl,
        email,
        passwordHash,
        ticket,
        ticketExpiresAt,
        isActive: REGISTRATION.AUTO_ACTIVATE_NEW_USERS,
        emailVerified: false,
        locale,
        defaultRole,
        roles: {
          data: userRoles,
        },
      },
    })
    .then((res) => res.insertUser);

  if (!user) {
    throw new Error("Unable to insert new user");
  }

  await insertProfile({ userId: user.id, profile });

  // user is now inserted. Continue sending out activation email
  if (!REGISTRATION.AUTO_ACTIVATE_NEW_USERS && AUTHENTICATION.VERIFY_EMAILS) {
    if (!APPLICATION.EMAILS_ENABLED) {
      throw new Error("SMTP settings unavailable");
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
  }

  return res.status(200).send("OK");
};
