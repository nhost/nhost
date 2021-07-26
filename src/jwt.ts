import { TOKEN, REGISTRATION } from "@config/index";
import { JWK, JWKS, JWT } from "jose";

import { Claims, Token, ClaimValueType, PermissionVariables } from "./types";
import { UserFieldsFragment } from "./utils/__generated__/graphql-request";

// const RSA_TYPES = ["RS256", "RS384", "RS512"];
const SHA_TYPES = ["HS256", "HS384", "HS512"];

if (!SHA_TYPES.includes(TOKEN.ALGORITHM)) {
  throw new Error(`Invalid JWT algorithm: ${TOKEN.ALGORITHM}`);
}

if (!TOKEN.JWT_SECRET) {
  throw new Error("Empty JWT secret key");
}

/**
 * Create an object that contains all the permission variables of the user,
 * i.e. user-id, allowed-roles, default-role and the kebab-cased columns
 * of the public.tables columns defined in JWT_CUSTOM_FIELDS
 * @param jwt if true, add a 'x-hasura-' prefix to the property names, and stringifies the values (required by Hasura)
 */
export function generatePermissionVariables(
  user: UserFieldsFragment,
  JWTPrefix: boolean | string = false
): { [key: string]: ClaimValueType } {
  const prefix = JWTPrefix ? "x-hasura-" : "";
  const role =
    user.defaultRole || user.isAnonymous
      ? REGISTRATION.DEFAULT_ANONYMOUS_ROLE
      : REGISTRATION.DEFAULT_USER_ROLE;
  const userRoles = user.roles.map((role) => role.role);

  if (!userRoles.includes(role)) {
    userRoles.push(role);
  }

  // const customRegisterData =
  //   user.customRegisterData &&
  //   (Object.fromEntries(
  //     Object.entries(user.customRegisterData).map(([k, v]) => [
  //       `${prefix}${k}`,
  //       v,
  //     ])
  //   ) as { [key: string]: ClaimValueType });

  return {
    [`${prefix}user-id`]: user.id,
    [`${prefix}allowed-roles`]: userRoles,
    [`${prefix}default-role`]: role,
    // ...customRegisterData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // TODO: Get user.profile data + custom fields (config )
    // TODO: and populate this...
    // ...TOKEN.CUSTOM_FIELDS.reduce<{ [key: string]: ClaimValueType }>((aggr: any, cursor) => {
    //   const type = typeof user[cursor] as ClaimValueType

    //   let value
    //   if (type === 'string') {
    //     value = user[cursor]
    //   } else if (Array.isArray(user[cursor])) {
    //     value = toPgArray(user[cursor] as string[])
    //   } else {
    //     value = JSON.stringify(user[cursor] ?? null)
    //   }

    //   aggr[`${prefix}${kebabCase(cursor)}`] = value

    //   return aggr
    // }, {})
  };
}

/**
 * * Signs a payload with the existing JWT configuration
 */
export const sign = ({
  payload,
  user,
}: {
  payload: object;
  user: UserFieldsFragment;
}) => {
  return JWT.sign(payload, TOKEN.JWT_SECRET, {
    algorithm: TOKEN.ALGORITHM,
    expiresIn: `${TOKEN.ACCESS_TOKEN_EXPIRES_IN}s`,
    subject: user.id,
    issuer: "nhost",
  });
};

/**
 * Verify JWT token and return the Hasura claims.
 * @param authorization Authorization header.
 */
export const getClaims = (authorization: string | undefined): Claims => {
  if (!authorization) throw new Error("Missing Authorization header");
  const token = authorization.replace("Bearer ", "");
  try {
    const decodedToken = JWT.verify(token, TOKEN.JWT_SECRET) as Token;
    if (!decodedToken[TOKEN.CLAIMS_NAMESPACE])
      throw new Error("Claims namespace not found");
    return decodedToken[TOKEN.CLAIMS_NAMESPACE];
  } catch (err) {
    throw new Error("Invalid or expired JWT token");
  }
};

export const getPermissionVariablesFromClaims = (
  claims: Claims
): PermissionVariables => {
  // remove `x-hasura-` from claim props
  const claimsSanitized: { [k: string]: any } = {};
  for (const claimKey in claims) {
    claimsSanitized[claimKey.replace("x-hasura-", "") as string] =
      claims[claimKey];
  }

  return claimsSanitized as PermissionVariables;
};

/**
 * Create JWT token.
 */
export const createHasuraAccessToken = (user: UserFieldsFragment): string => {
  return sign({
    payload: {
      [TOKEN.CLAIMS_NAMESPACE]: generatePermissionVariables(user, true),
    },
    user,
  });
};
