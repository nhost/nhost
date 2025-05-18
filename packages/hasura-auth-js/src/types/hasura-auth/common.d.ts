export type AuthErrorPayload = {
    error: string;
    status: number;
    message: string;
};
/** User information */
export interface User {
    /** User's unique identifier (uuid) */
    id: string;
    /** The date-time when the user has been created */
    createdAt: string;
    /** User's display name */
    displayName: string;
    /** The URL to the user's profile picture */
    avatarUrl: string;
    /** The locale of the user, as a two-characters string
     * @example `'en'`
     */
    locale: string;
    /** User's email address */
    email?: string;
    /** Whether or not the user is anonymous */
    isAnonymous: boolean;
    /** The default role of the user
     * @example `'user'`
     */
    defaultRole: string;
    /** The roles assigned to the user
     * @example `['user', 'me']`
     */
    roles: string[];
    /** Additional attributes used for user information */
    metadata: Record<string, unknown>;
    /** Is `true` if the user email has not been verified */
    emailVerified: boolean;
    phoneNumber: string | null;
    phoneNumberVerified: boolean;
    activeMfaType: 'totp' | null;
}
export interface NhostSession {
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string | null;
    refreshTokenId?: string | null;
    user: User;
}
export type Provider = 'apple' | 'azuread' | 'bitbucket' | 'discord' | 'facebook' | 'github' | 'gitlab' | 'google' | 'linkedin' | 'spotify' | 'strava' | 'twitch' | 'twitter' | 'windowslive' | 'workos';
/**
 * Basic structure of a JWT that contains the default Hasura namespace.
 * @see {@link https://hasura.io/docs/1.0/graphql/core/auth/authentication/jwt.html#the-spec}
 */
export interface JWTClaims {
    sub?: string;
    iat?: number;
    exp?: number;
    iss?: string;
    'https://hasura.io/jwt/claims': JWTHasuraClaims;
}
export interface JWTHasuraClaims {
    [claim: string]: string | string[] | null;
    'x-hasura-allowed-roles': string[];
    'x-hasura-default-role': string;
    'x-hasura-user-id': string;
    'x-hasura-user-is-anonymous': string;
    'x-hasura-auth-elevated': string;
}
export interface Mfa {
    ticket: string;
}
/** Data of a WebAuthn security key */
export interface SecurityKey {
    /** Unique indentifier of the security key */
    id: string;
    /** Human-readable nickname fof the security key */
    nickname?: string;
}
/**
 * Data of a personal access token creation response.
 */
export interface PersonalAccessTokenCreationResponse {
    /**
     * The personal access token identifier.
     */
    id: string;
    /**
     * The personal access token.
     */
    personalAccessToken: string;
}
//# sourceMappingURL=common.d.ts.map