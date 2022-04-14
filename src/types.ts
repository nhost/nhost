import { UserQuery } from './utils/__generated__/graphql-request';

export type ClaimValueType =
  | string
  | string[]
  | number
  | number[]
  | RegExp
  | RegExp[]
  | boolean
  | boolean[]
  | null
  | undefined;

/**
 * Claims interface.
 */
export interface Claims {
  'x-hasura-user-id': string;
  'x-hasura-default-role': string;
  'x-hasura-allowed-roles': string[];
  [key: string]: ClaimValueType;
}

/**
 * PermissionVariables interface.
 */
export interface PermissionVariables {
  'user-id': string;
  'default-role': string;
  'allowed-roles': string[];
  [key: string]: ClaimValueType;
}

/**
 * Token interface.
 */
export type Token = {
  [key: string]: Claims;
} & {
  'https://hasura.io/jwt/claims': Claims;
  exp: bigint;
  iat: bigint;
  iss: string;
  sub: string;
};

// Session and user
type Metadata = Record<string, unknown>;

export type UserRegistrationOptions = {
  locale: string;
  allowedRoles: string[];
  defaultRole: string;
  displayName?: string;
  metadata: Metadata;
};

export type User = Pick<
  NonNullable<UserQuery['user']>,
  | 'id'
  | 'createdAt'
  | 'displayName'
  | 'avatarUrl'
  | 'locale'
  | 'email'
  | 'isAnonymous'
  | 'defaultRole'
  | 'metadata'
  | 'emailVerified'
  | 'phoneNumber'
  | 'phoneNumberVerified'
  | 'activeMfaType'
> & { roles: string[] };

export type Session = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user?: User;
};

export type Mfa = {
  ticket: string | null;
};

export type SignInResponse = {
  session: Session | null;
  mfa: Mfa | null;
};

export type PasswordLessEmailBody = {
  email: string;
  options: UserRegistrationOptions & {
    redirectTo: string;
  };
};

export type PasswordLessSmsBody = {
  phoneNumber: string;
  options: UserRegistrationOptions;
};

export type OtpSmsBody = {
  phoneNumber: string;
  otp: string;
};

export type JwtSecret = {
  type: 'HS256' | 'HS238' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'Ed25519';
  key: string;
  jwk_url?: string;
  claims_namespace?: string;
  claims_namespace_path?: string;
  claims_format?: string;
  audience?: string;
  issuer?: string;
  claims_map?: string;
  allowed_skew?: string;
  header?: string;
};

export const EMAIL_TYPES = {
  VERIFY: 'emailVerify',
  CONFIRM_CHANGE: 'emailConfirmChange',
  SIGNIN_PASSWORDLESS: 'signinPasswordless',
  PASSWORD_RESET: 'passwordReset',
} as const;
export type EmailType = typeof EMAIL_TYPES[keyof typeof EMAIL_TYPES];
