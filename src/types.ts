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

export type UserRegistrationOptionsWithRedirect = UserRegistrationOptions & {
  redirectTo: string;
};

export type Session = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user?: SessionUser;
};

export type Mfa = {
  ticket: string | null;
};

export type SignInResponse = {
  session: Session | null;
  mfa: Mfa | null;
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

export type User = {
  id: string;
  createdAt: Date;
  displayName: string;
  newEmail: string | null;
  avatarUrl: string;
  locale: string;
  email: string;
  isAnonymous: boolean;
  defaultRole: string;
  totpSecret?: string;
  disabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneNumberVerified: boolean;
  activeMfaType: string | null;
  roles: string[];
  ticket: string | null;
  passwordHash: string | null;
  otpHash: string | null;
  otpHashExpiresAt?: Date;
  webauthnCurrentChallenge: string | null;
  ticketExpiresAt?: Date;
  otpMethodLastUsed?: string;
  lastSeen: Date;
};

export type SessionUser = Pick<
  User,
  | 'createdAt'
  | 'id'
  | 'displayName'
  | 'avatarUrl'
  | 'locale'
  | 'email'
  | 'roles'
  | 'isAnonymous'
  | 'defaultRole'
  | 'metadata'
  | 'emailVerified'
  | 'phoneNumber'
  | 'phoneNumberVerified'
  | 'activeMfaType'
>;
