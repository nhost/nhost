/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from '../fetch';
import { createEnhancedFetch, FetchError } from '../fetch';

/**
 * The attestation statement format
 */
export type AttestationFormat =
  | 'packed'
  | 'tpm'
  | 'android-key'
  | 'android-safetynet'
  | 'fido-u2f'
  | 'apple'
  | 'none';

/**
 * Map of extension outputs from the client
 @property appid? (`boolean`) - Application identifier extension output
 @property credProps? (`CredentialPropertiesOutput`) - Credential properties extension output
 @property hmacCreateSecret? (`boolean`) - HMAC secret extension output*/
export interface AuthenticationExtensionsClientOutputs {
  /**
   * Application identifier extension output
   */
  appid?: boolean;
  /**
   * Credential properties extension output
   */
  credProps?: CredentialPropertiesOutput;
  /**
   * HMAC secret extension output
   */
  hmacCreateSecret?: boolean;
}

/**
 * 
 @property clientDataJSON (`string`) - Base64url encoded client data JSON
 @property authenticatorData (`string`) - Base64url encoded authenticator data
 @property signature (`string`) - Base64url encoded assertion signature
 @property userHandle? (`string`) - Base64url encoded user handle*/
export interface AuthenticatorAssertionResponse {
  /**
   * Base64url encoded client data JSON
   */
  clientDataJSON: string;
  /**
   * Base64url encoded authenticator data
   */
  authenticatorData: string;
  /**
   * Base64url encoded assertion signature
   */
  signature: string;
  /**
   * Base64url encoded user handle
   */
  userHandle?: string;
}

/**
 * The authenticator attachment modality
 */
export type AuthenticatorAttachment = 'platform' | 'cross-platform';

/**
 * 
 @property clientDataJSON (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property transports? (`string[]`) - The authenticator transports
 @property authenticatorData? (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property publicKey? (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property publicKeyAlgorithm? (`number`) - The public key algorithm identifier
    *    Format - int64
 @property attestationObject (`string`) - Base64url-encoded binary data
    *    Format - byte*/
export interface AuthenticatorAttestationResponse {
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  clientDataJSON: string;
  /**
   * The authenticator transports
   */
  transports?: string[];
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  authenticatorData?: string;
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  publicKey?: string;
  /**
   * The public key algorithm identifier
   *    Format - int64
   */
  publicKeyAlgorithm?: number;
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  attestationObject: string;
}

/**
 * 
 @property authenticatorAttachment? (`AuthenticatorAttachment`) - The authenticator attachment modality
 @property requireResidentKey? (`boolean`) - Whether the authenticator must create a client-side-resident public key credential source
 @property residentKey? (`ResidentKeyRequirement`) - The resident key requirement
 @property userVerification? (`UserVerificationRequirement`) - A requirement for user verification for the operation*/
export interface AuthenticatorSelection {
  /**
   * The authenticator attachment modality
   */
  authenticatorAttachment?: AuthenticatorAttachment;
  /**
   * Whether the authenticator must create a client-side-resident public key credential source
   */
  requireResidentKey?: boolean;
  /**
   * The resident key requirement
   */
  residentKey?: ResidentKeyRequirement;
  /**
   * A requirement for user verification for the operation
   */
  userVerification?: UserVerificationRequirement;
}

/**
 * The authenticator transports that can be used
 */
export type AuthenticatorTransport =
  | 'usb'
  | 'nfc'
  | 'ble'
  | 'smart-card'
  | 'hybrid'
  | 'internal';

/**
 * The attestation conveyance preference
 */
export type ConveyancePreference =
  | 'none'
  | 'indirect'
  | 'direct'
  | 'enterprise';

/**
 * 
 @property expiresAt (`string`) - Expiration date of the PAT
    *    Format - date-time
 @property metadata? (`Record<string, unknown>`) - 
    *    Example - `{"name":"my-pat","used-by":"my-app-cli"}`*/
export interface CreatePATRequest {
  /**
   * Expiration date of the PAT
   *    Format - date-time
   */
  expiresAt: string;
  /**
   *
   *    Example - `{"name":"my-pat","used-by":"my-app-cli"}`
   */
  metadata?: Record<string, unknown>;
}

/**
 * 
 @property id (`string`) - ID of the PAT
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
 @property personalAccessToken (`string`) - PAT
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b*/
export interface CreatePATResponse {
  /**
   * ID of the PAT
   *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
   *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  id: string;
  /**
   * PAT
   *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
   *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  personalAccessToken: string;
}

/**
 * 
 @property id (`string`) - The credential's identifier
 @property type (`string`) - The credential type represented by this object
 @property rawId (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property clientExtensionResults? (`AuthenticationExtensionsClientOutputs`) - Map of extension outputs from the client
 @property authenticatorAttachment? (`string`) - The authenticator attachment
 @property response (`AuthenticatorAssertionResponse`) - */
export interface CredentialAssertionResponse {
  /**
   * The credential's identifier
   */
  id: string;
  /**
   * The credential type represented by this object
   */
  type: string;
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  rawId: string;
  /**
   * Map of extension outputs from the client
   */
  clientExtensionResults?: AuthenticationExtensionsClientOutputs;
  /**
   * The authenticator attachment
   */
  authenticatorAttachment?: string;
  /**
   *
   */
  response: AuthenticatorAssertionResponse;
}

/**
 * 
 @property id (`string`) - The credential's identifier
 @property type (`string`) - The credential type represented by this object
 @property rawId (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property clientExtensionResults? (`AuthenticationExtensionsClientOutputs`) - Map of extension outputs from the client
 @property authenticatorAttachment? (`string`) - The authenticator attachment
 @property response (`AuthenticatorAttestationResponse`) - */
export interface CredentialCreationResponse {
  /**
   * The credential's identifier
   */
  id: string;
  /**
   * The credential type represented by this object
   */
  type: string;
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  rawId: string;
  /**
   * Map of extension outputs from the client
   */
  clientExtensionResults?: AuthenticationExtensionsClientOutputs;
  /**
   * The authenticator attachment
   */
  authenticatorAttachment?: string;
  /**
   *
   */
  response: AuthenticatorAttestationResponse;
}

/**
 * 
 @property type (`CredentialType`) - The valid credential types
 @property alg (`number`) - The cryptographic algorithm identifier*/
export interface CredentialParameter {
  /**
   * The valid credential types
   */
  type: CredentialType;
  /**
   * The cryptographic algorithm identifier
   */
  alg: number;
}

/**
 * Credential properties extension output
 @property rk? (`boolean`) - Indicates if the credential is a resident key*/
export interface CredentialPropertiesOutput {
  /**
   * Indicates if the credential is a resident key
   */
  rk?: boolean;
}

/**
 * The valid credential types
 */
export type CredentialType = 'public-key';

/**
 * Error code identifying the specific application error
 */
export type ErrorResponseError =
  | 'default-role-must-be-in-allowed-roles'
  | 'disabled-endpoint'
  | 'disabled-user'
  | 'email-already-in-use'
  | 'email-already-verified'
  | 'forbidden-anonymous'
  | 'internal-server-error'
  | 'invalid-email-password'
  | 'invalid-request'
  | 'locale-not-allowed'
  | 'password-too-short'
  | 'password-in-hibp-database'
  | 'redirectTo-not-allowed'
  | 'role-not-allowed'
  | 'signup-disabled'
  | 'unverified-user'
  | 'user-not-anonymous'
  | 'invalid-pat'
  | 'invalid-refresh-token'
  | 'invalid-ticket'
  | 'disabled-mfa-totp'
  | 'no-totp-secret'
  | 'invalid-totp'
  | 'mfa-type-not-found'
  | 'totp-already-active'
  | 'invalid-state'
  | 'oauth-token-echange-failed'
  | 'oauth-profile-fetch-failed'
  | 'oauth-provider-error'
  | 'invalid-otp'
  | 'cannot-send-sms'
  | 'provider-account-already-linked';

/**
 * Standardized error response
 @property status (`number`) - HTTP status error code
    *    Example - `400`
 @property message (`string`) - Human-friendly error message
    *    Example - `"Invalid email format"`
 @property error (`ErrorResponseError`) - Error code identifying the specific application error*/
export interface ErrorResponse {
  /**
   * HTTP status error code
   *    Example - `400`
   */
  status: number;
  /**
   * Human-friendly error message
   *    Example - `"Invalid email format"`
   */
  message: string;
  /**
   * Error code identifying the specific application error
   */
  error: ErrorResponseError;
}

/**
 *
 */
export type IdTokenProvider = 'apple' | 'google';

/**
 * JSON Web Key for JWT verification
 @property alg (`string`) - Algorithm used with this key
    *    Example - `"RS256"`
 @property e (`string`) - RSA public exponent
    *    Example - `"AQAB"`
 @property kid (`string`) - Key ID
    *    Example - `"key-id-1"`
 @property kty (`string`) - Key type
    *    Example - `"RSA"`
 @property n (`string`) - RSA modulus
    *    Example - `"abcd1234..."`
 @property use (`string`) - Key usage
    *    Example - `"sig"`*/
export interface JWK {
  /**
   * Algorithm used with this key
   *    Example - `"RS256"`
   */
  alg: string;
  /**
   * RSA public exponent
   *    Example - `"AQAB"`
   */
  e: string;
  /**
   * Key ID
   *    Example - `"key-id-1"`
   */
  kid: string;
  /**
   * Key type
   *    Example - `"RSA"`
   */
  kty: string;
  /**
   * RSA modulus
   *    Example - `"abcd1234..."`
   */
  n: string;
  /**
   * Key usage
   *    Example - `"sig"`
   */
  use: string;
}

/**
 * JSON Web Key Set for verifying JWT signatures
 @property keys (`JWK[]`) - Array of public keys*/
export interface JWKSet {
  /**
   * Array of public keys
   */
  keys: JWK[];
}

/**
 * 
 @property provider (`IdTokenProvider`) - 
 @property idToken (`string`) - Apple ID token
 @property nonce? (`string`) - Nonce used during sign in process*/
export interface LinkIdTokenRequest {
  /**
   *
   */
  provider: IdTokenProvider;
  /**
   * Apple ID token
   */
  idToken: string;
  /**
   * Nonce used during sign in process
   */
  nonce?: string;
}

/**
 * Challenge payload for multi-factor authentication
 @property ticket (`string`) - Ticket to use when completing the MFA challenge
    *    Example - `"mfaTotp:abc123def456"`*/
export interface MFAChallengePayload {
  /**
   * Ticket to use when completing the MFA challenge
   *    Example - `"mfaTotp:abc123def456"`
   */
  ticket: string;
}

/**
 *
 */
export type OKResponse = 'OK';

/**
 * 
 @property redirectTo? (`string`) - 
    *    Example - `"https://my-app.com/catch-redirection"`
    *    Format - uri*/
export interface OptionsRedirectTo {
  /**
   *
   *    Example - `"https://my-app.com/catch-redirection"`
   *    Format - uri
   */
  redirectTo?: string;
}

/**
 * 
 @property rp (`RelyingPartyEntity`) - 
 @property user (`UserEntity`) - 
 @property challenge (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property pubKeyCredParams (`CredentialParameter[]`) - The desired credential types and their respective cryptographic parameters
 @property timeout? (`number`) - A time, in milliseconds, that the caller is willing to wait for the call to complete
 @property excludeCredentials? (`PublicKeyCredentialDescriptor[]`) - A list of PublicKeyCredentialDescriptor objects representing public key credentials that are not acceptable to the caller
 @property authenticatorSelection? (`AuthenticatorSelection`) - 
 @property hints? (`PublicKeyCredentialHints[]`) - Hints to help guide the user through the experience
 @property attestation? (`ConveyancePreference`) - The attestation conveyance preference
 @property attestationFormats? (`AttestationFormat[]`) - The preferred attestation statement formats
 @property extensions? (`Record<string, unknown>`) - Additional parameters requesting additional processing by the client and authenticator*/
export interface PublicKeyCredentialCreationOptions {
  /**
   *
   */
  rp: RelyingPartyEntity;
  /**
   *
   */
  user: UserEntity;
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  challenge: string;
  /**
   * The desired credential types and their respective cryptographic parameters
   */
  pubKeyCredParams: CredentialParameter[];
  /**
   * A time, in milliseconds, that the caller is willing to wait for the call to complete
   */
  timeout?: number;
  /**
   * A list of PublicKeyCredentialDescriptor objects representing public key credentials that are not acceptable to the caller
   */
  excludeCredentials?: PublicKeyCredentialDescriptor[];
  /**
   *
   */
  authenticatorSelection?: AuthenticatorSelection;
  /**
   * Hints to help guide the user through the experience
   */
  hints?: PublicKeyCredentialHints[];
  /**
   * The attestation conveyance preference
   */
  attestation?: ConveyancePreference;
  /**
   * The preferred attestation statement formats
   */
  attestationFormats?: AttestationFormat[];
  /**
   * Additional parameters requesting additional processing by the client and authenticator
   */
  extensions?: Record<string, unknown>;
}

/**
 * 
 @property type (`CredentialType`) - The valid credential types
 @property id (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property transports? (`AuthenticatorTransport[]`) - The authenticator transports that can be used*/
export interface PublicKeyCredentialDescriptor {
  /**
   * The valid credential types
   */
  type: CredentialType;
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  id: string;
  /**
   * The authenticator transports that can be used
   */
  transports?: AuthenticatorTransport[];
}

/**
 * Hints to help guide the user through the experience
 */
export type PublicKeyCredentialHints =
  | 'security-key'
  | 'client-device'
  | 'hybrid';

/**
 * 
 @property challenge (`string`) - Base64url-encoded binary data
    *    Format - byte
 @property timeout? (`number`) - A time, in milliseconds, that the caller is willing to wait for the call to complete
 @property rpId? (`string`) - The RP ID the credential should be scoped to
 @property allowCredentials? (`PublicKeyCredentialDescriptor[]`) - A list of CredentialDescriptor objects representing public key credentials acceptable to the caller
 @property userVerification? (`UserVerificationRequirement`) - A requirement for user verification for the operation
 @property hints? (`PublicKeyCredentialHints[]`) - Hints to help guide the user through the experience
 @property extensions? (`Record<string, unknown>`) - Additional parameters requesting additional processing by the client and authenticator*/
export interface PublicKeyCredentialRequestOptions {
  /**
   * Base64url-encoded binary data
   *    Format - byte
   */
  challenge: string;
  /**
   * A time, in milliseconds, that the caller is willing to wait for the call to complete
   */
  timeout?: number;
  /**
   * The RP ID the credential should be scoped to
   */
  rpId?: string;
  /**
   * A list of CredentialDescriptor objects representing public key credentials acceptable to the caller
   */
  allowCredentials?: PublicKeyCredentialDescriptor[];
  /**
   * A requirement for user verification for the operation
   */
  userVerification?: UserVerificationRequirement;
  /**
   * Hints to help guide the user through the experience
   */
  hints?: PublicKeyCredentialHints[];
  /**
   * Additional parameters requesting additional processing by the client and authenticator
   */
  extensions?: Record<string, unknown>;
}

/**
 * OAuth2 provider session containing access and refresh tokens
 @property accessToken (`string`) - OAuth2 provider access token for API calls
    *    Example - `"ya29.a0AfH6SMBx..."`
 @property expiresIn (`number`) - Number of seconds until the access token expires
    *    Example - `3599`
 @property expiresAt (`string`) - Timestamp when the access token expires
    *    Example - `"2024-12-31T23:59:59Z"`
    *    Format - date-time
 @property refreshToken? (`string`) - OAuth2 provider refresh token for obtaining new access tokens (if provided by the provider)
    *    Example - `"1//0gK8..."`*/
export interface ProviderSession {
  /**
   * OAuth2 provider access token for API calls
   *    Example - `"ya29.a0AfH6SMBx..."`
   */
  accessToken: string;
  /**
   * Number of seconds until the access token expires
   *    Example - `3599`
   */
  expiresIn: number;
  /**
   * Timestamp when the access token expires
   *    Example - `"2024-12-31T23:59:59Z"`
   *    Format - date-time
   */
  expiresAt: string;
  /**
   * OAuth2 provider refresh token for obtaining new access tokens (if provided by the provider)
   *    Example - `"1//0gK8..."`
   */
  refreshToken?: string;
}

/**
 * 
 @property connection? (`string`) - (workos) Specifies the connection to use for authentication
 @property organization? (`string`) - (workos) Specifies the organization to use for authentication*/
export interface ProviderSpecificParams {
  /**
   * (workos) Specifies the connection to use for authentication
   */
  connection?: string;
  /**
   * (workos) Specifies the organization to use for authentication
   */
  organization?: string;
}

/**
 * Request to refresh OAuth2 provider tokens
 @property refreshToken (`string`) - OAuth2 provider refresh token obtained from previous authentication
    *    Example - `"1//0gK8..."`*/
export interface RefreshProviderTokenRequest {
  /**
   * OAuth2 provider refresh token obtained from previous authentication
   *    Example - `"1//0gK8..."`
   */
  refreshToken: string;
}

/**
 * Request to refresh an access token
 @property refreshToken (`string`) - Refresh token used to generate a new access token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b*/
export interface RefreshTokenRequest {
  /**
   * Refresh token used to generate a new access token
   *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
   *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  refreshToken: string;
}

/**
 * 
 @property name (`string`) - A human-palatable name for the entity
 @property id (`string`) - A unique identifier for the Relying Party entity, which sets the RP ID*/
export interface RelyingPartyEntity {
  /**
   * A human-palatable name for the entity
   */
  name: string;
  /**
   * A unique identifier for the Relying Party entity, which sets the RP ID
   */
  id: string;
}

/**
 * The resident key requirement
 */
export type ResidentKeyRequirement = 'discouraged' | 'preferred' | 'required';

/**
 * User authentication session containing tokens and user information
 @property accessToken (`string`) - JWT token for authenticating API requests
    *    Example - `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
 @property accessTokenExpiresIn (`number`) - Expiration time of the access token in seconds
    *    Example - `900`
    *    Format - int64
 @property refreshTokenId (`string`) - Identifier for the refresh token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
 @property refreshToken (`string`) - Token used to refresh the access token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
 @property user? (`User`) - User profile and account information*/
export interface Session {
  /**
   * JWT token for authenticating API requests
   *    Example - `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
   */
  accessToken: string;
  /**
   * Expiration time of the access token in seconds
   *    Example - `900`
   *    Format - int64
   */
  accessTokenExpiresIn: number;
  /**
   * Identifier for the refresh token
   *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
   *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  refreshTokenId: string;
  /**
   * Token used to refresh the access token
   *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
   *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  refreshToken: string;
  /**
   * User profile and account information
   */
  user?: User;
}

/**
 * Container for session information
 @property session? (`Session`) - User authentication session containing tokens and user information*/
export interface SessionPayload {
  /**
   * User authentication session containing tokens and user information
   */
  session?: Session;
}

/**
 * 
 @property displayName? (`string`) - 
    *    Example - `"John Smith"`
 @property locale? (`string`) - A two or three characters locale
    *    Example - `"en"`
    *    MinLength - 2
    *    MaxLength - 3
 @property metadata? (`Record<string, unknown>`) - 
    *    Example - `{"firstName":"John","lastName":"Smith"}`*/
export interface SignInAnonymousRequest {
  /**
   *
   *    Example - `"John Smith"`
   */
  displayName?: string;
  /**
   * A two or three characters locale
   *    Example - `"en"`
   *    MinLength - 2
   *    MaxLength - 3
   */
  locale?: string;
  /**
   *
   *    Example - `{"firstName":"John","lastName":"Smith"}`
   */
  metadata?: Record<string, unknown>;
}

/**
 * Request to authenticate using email and password
 @property email (`string`) - User's email address
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property password (`string`) - User's password
    *    Example - `"Str0ngPassw#ord-94|%"`
    *    MinLength - 3
    *    MaxLength - 50*/
export interface SignInEmailPasswordRequest {
  /**
   * User's email address
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   * User's password
   *    Example - `"Str0ngPassw#ord-94|%"`
   *    MinLength - 3
   *    MaxLength - 50
   */
  password: string;
}

/**
 * Response for email-password authentication that may include a session or MFA challenge
 @property session? (`Session`) - User authentication session containing tokens and user information
 @property mfa? (`MFAChallengePayload`) - Challenge payload for multi-factor authentication*/
export interface SignInEmailPasswordResponse {
  /**
   * User authentication session containing tokens and user information
   */
  session?: Session;
  /**
   * Challenge payload for multi-factor authentication
   */
  mfa?: MFAChallengePayload;
}

/**
 * 
 @property provider (`IdTokenProvider`) - 
 @property idToken (`string`) - Apple ID token
 @property nonce? (`string`) - Nonce used during sign in process
 @property options? (`SignUpOptions`) - */
export interface SignInIdTokenRequest {
  /**
   *
   */
  provider: IdTokenProvider;
  /**
   * Apple ID token
   */
  idToken: string;
  /**
   * Nonce used during sign in process
   */
  nonce?: string;
  /**
   *
   */
  options?: SignUpOptions;
}

/**
 * 
 @property ticket (`string`) - Ticket
    *    Pattern - ^mfaTotp:.*$
 @property otp (`string`) - One time password*/
export interface SignInMfaTotpRequest {
  /**
   * Ticket
   *    Pattern - ^mfaTotp:.*$
   */
  ticket: string;
  /**
   * One time password
   */
  otp: string;
}

/**
 * 
 @property email (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property options? (`SignUpOptions`) - */
export interface SignInOTPEmailRequest {
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   *
   */
  options?: SignUpOptions;
}

/**
 * 
 @property otp (`string`) - One time password
 @property email (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email*/
export interface SignInOTPEmailVerifyRequest {
  /**
   * One time password
   */
  otp: string;
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
}

/**
 * 
 @property session? (`Session`) - User authentication session containing tokens and user information*/
export interface SignInOTPEmailVerifyResponse {
  /**
   * User authentication session containing tokens and user information
   */
  session?: Session;
}

/**
 * 
 @property personalAccessToken (`string`) - PAT
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b*/
export interface SignInPATRequest {
  /**
   * PAT
   *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
   *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  personalAccessToken: string;
}

/**
 * 
 @property email (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property options? (`SignUpOptions`) - */
export interface SignInPasswordlessEmailRequest {
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   *
   */
  options?: SignUpOptions;
}

/**
 * 
 @property phoneNumber (`string`) - Phone number of the user
    *    Example - `"+123456789"`
 @property otp (`string`) - One-time password received by SMS*/
export interface SignInPasswordlessSmsOtpRequest {
  /**
   * Phone number of the user
   *    Example - `"+123456789"`
   */
  phoneNumber: string;
  /**
   * One-time password received by SMS
   */
  otp: string;
}

/**
 * 
 @property session? (`Session`) - User authentication session containing tokens and user information
 @property mfa? (`MFAChallengePayload`) - Challenge payload for multi-factor authentication*/
export interface SignInPasswordlessSmsOtpResponse {
  /**
   * User authentication session containing tokens and user information
   */
  session?: Session;
  /**
   * Challenge payload for multi-factor authentication
   */
  mfa?: MFAChallengePayload;
}

/**
 * 
 @property phoneNumber (`string`) - Phone number of the user
    *    Example - `"+123456789"`
 @property options? (`SignUpOptions`) - */
export interface SignInPasswordlessSmsRequest {
  /**
   * Phone number of the user
   *    Example - `"+123456789"`
   */
  phoneNumber: string;
  /**
   *
   */
  options?: SignUpOptions;
}

/**
 * 
 @property email? (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email*/
export interface SignInWebauthnRequest {
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email?: string;
}

/**
 * 
 @property email? (`string`) - A valid email. Deprecated, no longer used
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property credential (`CredentialAssertionResponse`) - */
export interface SignInWebauthnVerifyRequest {
  /**
   * A valid email. Deprecated, no longer used
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email?: string;
  /**
   *
   */
  credential: CredentialAssertionResponse;
}

/**
 * 
 @property refreshToken? (`string`) - Refresh token for the current session
 @property all? (`boolean`) - Sign out from all connected devices*/
export interface SignOutRequest {
  /**
   * Refresh token for the current session
   */
  refreshToken?: string;
  /**
   * Sign out from all connected devices
   */
  all?: boolean;
}

/**
 * Request to register a new user with email and password
 @property email (`string`) - Email address for the new user account
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property password (`string`) - Password for the new user account
    *    Example - `"Str0ngPassw#ord-94|%"`
    *    MinLength - 3
    *    MaxLength - 50
 @property options? (`SignUpOptions`) - */
export interface SignUpEmailPasswordRequest {
  /**
   * Email address for the new user account
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   * Password for the new user account
   *    Example - `"Str0ngPassw#ord-94|%"`
   *    MinLength - 3
   *    MaxLength - 50
   */
  password: string;
  /**
   *
   */
  options?: SignUpOptions;
}

/**
 * 
 @property allowedRoles? (`string[]`) - 
    *    Example - `["me","user"]`
 @property defaultRole? (`string`) - 
    *    Example - `"user"`
 @property displayName? (`string`) - 
    *    Example - `"John Smith"`
    *    Pattern - ^[\p{L}\p{N}\p{S} ,.'-]+$
    *    MaxLength - 32
 @property locale? (`string`) - A two or three characters locale
    *    Example - `"en"`
    *    MinLength - 2
    *    MaxLength - 3
 @property metadata? (`Record<string, unknown>`) - 
    *    Example - `{"firstName":"John","lastName":"Smith"}`
 @property redirectTo? (`string`) - 
    *    Example - `"https://my-app.com/catch-redirection"`
    *    Format - uri*/
export interface SignUpOptions {
  /**
   *
   *    Example - `["me","user"]`
   */
  allowedRoles?: string[];
  /**
   *
   *    Example - `"user"`
   */
  defaultRole?: string;
  /**
   *
   *    Example - `"John Smith"`
   *    Pattern - ^[\p{L}\p{N}\p{S} ,.'-]+$
   *    MaxLength - 32
   */
  displayName?: string;
  /**
   * A two or three characters locale
   *    Example - `"en"`
   *    MinLength - 2
   *    MaxLength - 3
   */
  locale?: string;
  /**
   *
   *    Example - `{"firstName":"John","lastName":"Smith"}`
   */
  metadata?: Record<string, unknown>;
  /**
   *
   *    Example - `"https://my-app.com/catch-redirection"`
   *    Format - uri
   */
  redirectTo?: string;
}

/**
 * 
 @property email (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property options? (`SignUpOptions`) - */
export interface SignUpWebauthnRequest {
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   *
   */
  options?: SignUpOptions;
}

/**
 * 
 @property credential (`CredentialCreationResponse`) - 
 @property options? (`SignUpOptions`) - 
 @property nickname? (`string`) - Nickname for the security key*/
export interface SignUpWebauthnVerifyRequest {
  /**
   *
   */
  credential: CredentialCreationResponse;
  /**
   *
   */
  options?: SignUpOptions;
  /**
   * Nickname for the security key
   */
  nickname?: string;
}

/**
 * Response containing TOTP setup information for MFA
 @property imageUrl (`string`) - URL to QR code image for scanning with an authenticator app
    *    Example - `"data:image/png;base64,iVBORw0KGg..."`
 @property totpSecret (`string`) - TOTP secret key for manual setup with an authenticator app
    *    Example - `"ABCDEFGHIJK23456"`*/
export interface TotpGenerateResponse {
  /**
   * URL to QR code image for scanning with an authenticator app
   *    Example - `"data:image/png;base64,iVBORw0KGg..."`
   */
  imageUrl: string;
  /**
   * TOTP secret key for manual setup with an authenticator app
   *    Example - `"ABCDEFGHIJK23456"`
   */
  totpSecret: string;
}

/**
 * Base64url-encoded binary data
 */
export type URLEncodedBase64 = string;

/**
 * User profile and account information
 @property avatarUrl (`string`) - URL to the user's profile picture
    *    Example - `"https://myapp.com/avatars/user123.jpg"`
 @property createdAt (`string`) - Timestamp when the user account was created
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
 @property defaultRole (`string`) - Default authorization role for the user
    *    Example - `"user"`
 @property displayName (`string`) - User's display name
    *    Example - `"John Smith"`
 @property email? (`string`) - User's email address
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property emailVerified (`boolean`) - Whether the user's email has been verified
    *    Example - `true`
 @property id (`string`) - Unique identifier for the user
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
 @property isAnonymous (`boolean`) - Whether this is an anonymous user account
    *    Example - `false`
 @property locale (`string`) - User's preferred locale (language code)
    *    Example - `"en"`
    *    MinLength - 2
    *    MaxLength - 3
 @property metadata (`Record<string, unknown>`) - Custom metadata associated with the user
    *    Example - `{"firstName":"John","lastName":"Smith"}`
 @property phoneNumber? (`string`) - User's phone number
    *    Example - `"+12025550123"`
 @property phoneNumberVerified (`boolean`) - Whether the user's phone number has been verified
    *    Example - `false`
 @property roles (`string[]`) - List of roles assigned to the user
    *    Example - `["user","customer"]`
 @property activeMfaType? (`string`) - Active MFA type for the user*/
export interface User {
  /**
   * URL to the user's profile picture
   *    Example - `"https://myapp.com/avatars/user123.jpg"`
   */
  avatarUrl: string;
  /**
   * Timestamp when the user account was created
   *    Example - `"2023-01-15T12:34:56Z"`
   *    Format - date-time
   */
  createdAt: string;
  /**
   * Default authorization role for the user
   *    Example - `"user"`
   */
  defaultRole: string;
  /**
   * User's display name
   *    Example - `"John Smith"`
   */
  displayName: string;
  /**
   * User's email address
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email?: string;
  /**
   * Whether the user's email has been verified
   *    Example - `true`
   */
  emailVerified: boolean;
  /**
   * Unique identifier for the user
   *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
   *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  id: string;
  /**
   * Whether this is an anonymous user account
   *    Example - `false`
   */
  isAnonymous: boolean;
  /**
   * User's preferred locale (language code)
   *    Example - `"en"`
   *    MinLength - 2
   *    MaxLength - 3
   */
  locale: string;
  /**
   * Custom metadata associated with the user
   *    Example - `{"firstName":"John","lastName":"Smith"}`
   */
  metadata: Record<string, unknown>;
  /**
   * User's phone number
   *    Example - `"+12025550123"`
   */
  phoneNumber?: string;
  /**
   * Whether the user's phone number has been verified
   *    Example - `false`
   */
  phoneNumberVerified: boolean;
  /**
   * List of roles assigned to the user
   *    Example - `["user","customer"]`
   */
  roles: string[];
  /**
   * Active MFA type for the user
   */
  activeMfaType?: string;
}

/**
 * Which sign-in method to use
 */
export type UserDeanonymizeRequestSignInMethod =
  | 'email-password'
  | 'passwordless';

/**
 * 
 @property signInMethod (`UserDeanonymizeRequestSignInMethod`) - Which sign-in method to use
 @property email (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property password? (`string`) - A password of minimum 3 characters
    *    Example - `"Str0ngPassw#ord-94|%"`
    *    MinLength - 3
    *    MaxLength - 50
 @property connection? (`string`) - Deprecated, will be ignored
 @property options? (`SignUpOptions`) - */
export interface UserDeanonymizeRequest {
  /**
   * Which sign-in method to use
   */
  signInMethod: UserDeanonymizeRequestSignInMethod;
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   * A password of minimum 3 characters
   *    Example - `"Str0ngPassw#ord-94|%"`
   *    MinLength - 3
   *    MaxLength - 50
   */
  password?: string;
  /**
   * Deprecated, will be ignored
   */
  connection?: string;
  /**
   *
   */
  options?: SignUpOptions;
}

/**
 * 
 @property newEmail (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property options? (`OptionsRedirectTo`) - */
export interface UserEmailChangeRequest {
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  newEmail: string;
  /**
   *
   */
  options?: OptionsRedirectTo;
}

/**
 * 
 @property email (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property options? (`OptionsRedirectTo`) - */
export interface UserEmailSendVerificationEmailRequest {
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   *
   */
  options?: OptionsRedirectTo;
}

/**
 * 
 @property name (`string`) - A human-palatable name for the entity
 @property displayName (`string`) - A human-palatable name for the user account, intended only for display
 @property id (`string`) - The user handle of the user account entity*/
export interface UserEntity {
  /**
   * A human-palatable name for the entity
   */
  name: string;
  /**
   * A human-palatable name for the user account, intended only for display
   */
  displayName: string;
  /**
   * The user handle of the user account entity
   */
  id: string;
}

/**
 * Type of MFA to activate. Use empty string to disable MFA.
 */
export type UserMfaRequestActiveMfaType = 'totp' | '';

/**
 * Request to activate or deactivate multi-factor authentication
 @property code (`string`) - Verification code from the authenticator app when activating MFA
    *    Example - `"123456"`
 @property activeMfaType? (`UserMfaRequestActiveMfaType`) - Type of MFA to activate. Use empty string to disable MFA.
    *    Example - `"totp"`*/
export interface UserMfaRequest {
  /**
   * Verification code from the authenticator app when activating MFA
   *    Example - `"123456"`
   */
  code: string;
  /**
   * Type of MFA to activate. Use empty string to disable MFA.
   *    Example - `"totp"`
   */
  activeMfaType?: UserMfaRequestActiveMfaType;
}

/**
 * 
 @property newPassword (`string`) - A password of minimum 3 characters
    *    Example - `"Str0ngPassw#ord-94|%"`
    *    MinLength - 3
    *    MaxLength - 50
 @property ticket? (`string`) - Ticket to reset the password, required if the user is not authenticated
    *    Pattern - ^passwordReset\:.*$*/
export interface UserPasswordRequest {
  /**
   * A password of minimum 3 characters
   *    Example - `"Str0ngPassw#ord-94|%"`
   *    MinLength - 3
   *    MaxLength - 50
   */
  newPassword: string;
  /**
   * Ticket to reset the password, required if the user is not authenticated
   *    Pattern - ^passwordReset\:.*$
   */
  ticket?: string;
}

/**
 * 
 @property email (`string`) - A valid email
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property options? (`OptionsRedirectTo`) - */
export interface UserPasswordResetRequest {
  /**
   * A valid email
   *    Example - `"john.smith@nhost.io"`
   *    Format - email
   */
  email: string;
  /**
   *
   */
  options?: OptionsRedirectTo;
}

/**
 * A requirement for user verification for the operation
 */
export type UserVerificationRequirement =
  | 'required'
  | 'preferred'
  | 'discouraged';

/**
 * 
 @property credential (`CredentialCreationResponse`) - 
 @property nickname? (`string`) - Optional nickname for the security key*/
export interface VerifyAddSecurityKeyRequest {
  /**
   *
   */
  credential: CredentialCreationResponse;
  /**
   * Optional nickname for the security key
   */
  nickname?: string;
}

/**
 * 
 @property id (`string`) - The ID of the newly added security key
    *    Example - `"123e4567-e89b-12d3-a456-426614174000"`
 @property nickname? (`string`) - The nickname of the security key if provided*/
export interface VerifyAddSecurityKeyResponse {
  /**
   * The ID of the newly added security key
   *    Example - `"123e4567-e89b-12d3-a456-426614174000"`
   */
  id: string;
  /**
   * The nickname of the security key if provided
   */
  nickname?: string;
}

/**
 * 
 @property token? (`string`) - JWT token to verify*/
export interface VerifyTokenRequest {
  /**
   * JWT token to verify
   */
  token?: string;
}

/**
 * 
 @property error (`string`) - OAuth2 error code
 @property error_description? (`string`) - Human-readable error description*/
export interface OAuth2ErrorResponse {
  /**
   * OAuth2 error code
   */
  error: string;
  /**
   * Human-readable error description
   */
  error_description?: string;
}

/**
 * 
 @property issuer (`string`) - 
 @property authorization_endpoint (`string`) - 
 @property token_endpoint (`string`) - 
 @property userinfo_endpoint? (`string`) - 
 @property jwks_uri (`string`) - 
 @property revocation_endpoint? (`string`) - 
 @property introspection_endpoint? (`string`) - 
 @property scopes_supported? (`string[]`) - 
 @property response_types_supported (`string[]`) - 
 @property grant_types_supported? (`string[]`) - 
 @property subject_types_supported? (`string[]`) - 
 @property id_token_signing_alg_values_supported? (`string[]`) - 
 @property token_endpoint_auth_methods_supported? (`string[]`) - 
 @property code_challenge_methods_supported? (`string[]`) - 
 @property claims_supported? (`string[]`) - 
 @property request_parameter_supported? (`boolean`) - 
 @property authorization_response_iss_parameter_supported? (`boolean`) - 
 @property client_id_metadata_document_supported? (`boolean`) - */
export interface OAuth2DiscoveryResponse {
  /**
   *
   */
  issuer: string;
  /**
   *
   */
  authorization_endpoint: string;
  /**
   *
   */
  token_endpoint: string;
  /**
   *
   */
  userinfo_endpoint?: string;
  /**
   *
   */
  jwks_uri: string;
  /**
   *
   */
  revocation_endpoint?: string;
  /**
   *
   */
  introspection_endpoint?: string;
  /**
   *
   */
  scopes_supported?: string[];
  /**
   *
   */
  response_types_supported: string[];
  /**
   *
   */
  grant_types_supported?: string[];
  /**
   *
   */
  subject_types_supported?: string[];
  /**
   *
   */
  id_token_signing_alg_values_supported?: string[];
  /**
   *
   */
  token_endpoint_auth_methods_supported?: string[];
  /**
   *
   */
  code_challenge_methods_supported?: string[];
  /**
   *
   */
  claims_supported?: string[];
  /**
   *
   */
  request_parameter_supported?: boolean;
  /**
   *
   */
  authorization_response_iss_parameter_supported?: boolean;
  /**
   *
   */
  client_id_metadata_document_supported?: boolean;
}

/**
 *
 */
export type OAuth2TokenRequestGrant_type =
  | 'authorization_code'
  | 'refresh_token';

/**
 * 
 @property grant_type (`OAuth2TokenRequestGrant_type`) - 
 @property code? (`string`) - 
 @property redirect_uri? (`string`) - 
 @property client_id? (`string`) - 
 @property client_secret? (`string`) - 
 @property code_verifier? (`string`) - 
 @property refresh_token? (`string`) - 
 @property resource? (`string`) - */
export interface OAuth2TokenRequest {
  /**
   *
   */
  grant_type: OAuth2TokenRequestGrant_type;
  /**
   *
   */
  code?: string;
  /**
   *
   */
  redirect_uri?: string;
  /**
   *
   */
  client_id?: string;
  /**
   *
   */
  client_secret?: string;
  /**
   *
   */
  code_verifier?: string;
  /**
   *
   */
  refresh_token?: string;
  /**
   *
   */
  resource?: string;
}

/**
 * 
 @property access_token (`string`) - 
 @property token_type (`string`) - 
 @property expires_in (`number`) - 
 @property refresh_token? (`string`) - 
 @property id_token? (`string`) - 
 @property scope? (`string`) - */
export interface OAuth2TokenResponse {
  /**
   *
   */
  access_token: string;
  /**
   *
   */
  token_type: string;
  /**
   *
   */
  expires_in: number;
  /**
   *
   */
  refresh_token?: string;
  /**
   *
   */
  id_token?: string;
  /**
   *
   */
  scope?: string;
}

/**
 * 
 @property sub (`string`) - 
 @property name? (`string`) - 
 @property email? (`string`) - 
 @property email_verified? (`boolean`) - 
 @property picture? (`string`) - 
 @property locale? (`string`) - 
 @property phone_number? (`string`) - 
 @property phone_number_verified? (`boolean`) - */
export interface OAuth2UserinfoResponse {
  /**
   *
   */
  sub: string;
  /**
   *
   */
  name?: string;
  /**
   *
   */
  email?: string;
  /**
   *
   */
  email_verified?: boolean;
  /**
   *
   */
  picture?: string;
  /**
   *
   */
  locale?: string;
  /**
   *
   */
  phone_number?: string;
  /**
   *
   */
  phone_number_verified?: boolean;
}

/**
 * 
 @property keys (`JWK[]`) - */
export interface OAuth2JWKSResponse {
  /**
   *
   */
  keys: JWK[];
}

/**
 *
 */
export type OAuth2RevokeRequestToken_type_hint =
  | 'access_token'
  | 'refresh_token';

/**
 * 
 @property token (`string`) - 
 @property token_type_hint? (`OAuth2RevokeRequestToken_type_hint`) - 
 @property client_id? (`string`) - 
 @property client_secret? (`string`) - */
export interface OAuth2RevokeRequest {
  /**
   *
   */
  token: string;
  /**
   *
   */
  token_type_hint?: OAuth2RevokeRequestToken_type_hint;
  /**
   *
   */
  client_id?: string;
  /**
   *
   */
  client_secret?: string;
}

/**
 *
 */
export type OAuth2IntrospectRequestToken_type_hint =
  | 'access_token'
  | 'refresh_token';

/**
 * 
 @property token (`string`) - 
 @property token_type_hint? (`OAuth2IntrospectRequestToken_type_hint`) - 
 @property client_id? (`string`) - 
 @property client_secret? (`string`) - */
export interface OAuth2IntrospectRequest {
  /**
   *
   */
  token: string;
  /**
   *
   */
  token_type_hint?: OAuth2IntrospectRequestToken_type_hint;
  /**
   *
   */
  client_id?: string;
  /**
   *
   */
  client_secret?: string;
}

/**
 * 
 @property active (`boolean`) - 
 @property scope? (`string`) - 
 @property client_id? (`string`) - 
 @property sub? (`string`) - 
 @property exp? (`number`) - 
 @property iat? (`number`) - 
 @property iss? (`string`) - 
 @property token_type? (`string`) - */
export interface OAuth2IntrospectResponse {
  /**
   *
   */
  active: boolean;
  /**
   *
   */
  scope?: string;
  /**
   *
   */
  client_id?: string;
  /**
   *
   */
  sub?: string;
  /**
   *
   */
  exp?: number;
  /**
   *
   */
  iat?: number;
  /**
   *
   */
  iss?: string;
  /**
   *
   */
  token_type?: string;
}

/**
 * 
 @property requestId (`string`) - 
    *    Format - uuid
 @property clientId (`string`) - 
 @property scopes (`string[]`) - 
 @property redirectUri (`string`) - */
export interface OAuth2LoginResponse {
  /**
   *
   *    Format - uuid
   */
  requestId: string;
  /**
   *
   */
  clientId: string;
  /**
   *
   */
  scopes: string[];
  /**
   *
   */
  redirectUri: string;
}

/**
 * 
 @property requestId (`string`) - 
    *    Format - uuid*/
export interface OAuth2LoginRequest {
  /**
   *
   *    Format - uuid
   */
  requestId: string;
}

/**
 * 
 @property redirectUri (`string`) - 
    *    Format - uri*/
export interface OAuth2LoginCompleteResponse {
  /**
   *
   *    Format - uri
   */
  redirectUri: string;
}

/**
 * Target URL for the redirect
 */
export type RedirectToQuery = string;

/**
 *
 */
export type SignInProvider =
  | 'apple'
  | 'github'
  | 'google'
  | 'linkedin'
  | 'discord'
  | 'spotify'
  | 'twitch'
  | 'gitlab'
  | 'bitbucket'
  | 'workos'
  | 'azuread'
  | 'entraid'
  | 'strava'
  | 'facebook'
  | 'windowslive'
  | 'twitter';

/**
 * Ticket
 */
export type TicketQuery = string;

/**
 * Type of the ticket
 */
export type TicketTypeQuery =
  | 'emailVerify'
  | 'emailConfirmChange'
  | 'signinPasswordless'
  | 'passwordReset';

/**
 * 
 @property version (`string`) - The version of the authentication service
    *    Example - `"1.2.3"`*/
export interface GetVersionResponse200 {
  /**
   * The version of the authentication service
   *    Example - `"1.2.3"`
   */
  version: string;
}

/**
 *
 */
export type GetCode_challenge_method = 'S256';

/**
 * 
 @property client_id (`string`) - 
 @property redirect_uri (`string`) - 
 @property response_type (`string`) - 
 @property scope? (`string`) - 
 @property state? (`string`) - 
 @property nonce? (`string`) - 
 @property code_challenge? (`string`) - 
 @property code_challenge_method? (`string`) - Only S256 is supported. The plain method is not allowed.
 @property resource? (`string`) - 
 @property prompt? (`string`) - */
export interface Oauth2AuthorizePostBody {
  /**
   *
   */
  client_id: string;
  /**
   *
   */
  redirect_uri: string;
  /**
   *
   */
  response_type: string;
  /**
   *
   */
  scope?: string;
  /**
   *
   */
  state?: string;
  /**
   *
   */
  nonce?: string;
  /**
   *
   */
  code_challenge?: string;
  /**
   * Only S256 is supported. The plain method is not allowed.
   */
  code_challenge_method?: string;
  /**
   *
   */
  resource?: string;
  /**
   *
   */
  prompt?: string;
}

/**
 * Parameters for the signInProvider method.
    @property allowedRoles? (string[]) - Array of allowed roles for the user
  
    @property defaultRole? (string) - Default role for the user
  
    @property displayName? (string) - Display name for the user
  
    @property locale? (string) - A two or three characters locale
  
    @property metadata? (Record<string, unknown>) - Additional metadata for the user (JSON encoded string)
  
    @property redirectTo? (string) - URI to redirect to
  
    @property connect? (string) - If set, this means that the user is already authenticated and wants to link their account. This needs to be a valid JWT access token.
  
    @property state? (string) - Opaque state value to be returned by the provider
  
    @property providerSpecificParams? (ProviderSpecificParams) - Additional provider-specific parameters
  */
export interface SignInProviderParams {
  /**
   * Array of allowed roles for the user
  
   */
  allowedRoles?: string[];
  /**
   * Default role for the user
  
   */
  defaultRole?: string;
  /**
   * Display name for the user
  
   */
  displayName?: string;
  /**
   * A two or three characters locale
  
   */
  locale?: string;
  /**
   * Additional metadata for the user (JSON encoded string)
  
   */
  metadata?: Record<string, unknown>;
  /**
   * URI to redirect to
  
   */
  redirectTo?: string;
  /**
   * If set, this means that the user is already authenticated and wants to link their account. This needs to be a valid JWT access token.
  
   */
  connect?: string;
  /**
   * Opaque state value to be returned by the provider
  
   */
  state?: string;
  /**
   * Additional provider-specific parameters
  
   */
  providerSpecificParams?: ProviderSpecificParams;
}
/**
 * Parameters for the verifyTicket method.
    @property ticket (TicketQuery) - Ticket
  
    *    Ticket
    @property type? (TicketTypeQuery) - Type of the ticket. Deprecated, no longer used
  
    *    Type of the ticket
    @property redirectTo (RedirectToQuery) - Target URL for the redirect
  
    *    Target URL for the redirect*/
export interface VerifyTicketParams {
  /**
   * Ticket
  
    *    Ticket
   */
  ticket: TicketQuery;
  /**
   * Type of the ticket. Deprecated, no longer used
  
    *    Type of the ticket
   */
  type?: TicketTypeQuery;
  /**
   * Target URL for the redirect
  
    *    Target URL for the redirect
   */
  redirectTo: RedirectToQuery;
}
/**
 * Parameters for the oauth2Authorize method.
    @property client_id (string) - The OAuth2 client identifier (RFC 6749 Section 2.2).
  
    @property redirect_uri (string) - The URI to redirect the user-agent to after authorization (RFC 6749 Section 3.1.2).
  
    @property response_type (string) - The authorization response type. Only 'code' is supported (RFC 6749 Section 3.1.1).
  
    @property scope? (string) - Space-delimited list of requested scopes (RFC 6749 Section 3.3).
  
    @property state? (string) - Opaque value used to maintain state between the request and callback (RFC 6749 Section 4.1.1).
  
    @property nonce? (string) - String value used to associate a client session with an ID token (OpenID Connect Core Section 3.1.2.1).
  
    @property code_challenge? (string) - PKCE code challenge derived from the code verifier (RFC 7636 Section 4.2).
  
    @property code_challenge_method? (GetCode_challenge_method) - Only S256 is supported. The plain method is not allowed.
  
    @property resource? (string) - Resource indicator for the target service (RFC 8707).
  
    @property prompt? (string) - Space-delimited list of prompts to present to the user (OpenID Connect Core Section 3.1.2.1).
  */
export interface Oauth2AuthorizeParams {
  /**
   * The OAuth2 client identifier (RFC 6749 Section 2.2).
  
   */
  client_id: string;
  /**
   * The URI to redirect the user-agent to after authorization (RFC 6749 Section 3.1.2).
  
   */
  redirect_uri: string;
  /**
   * The authorization response type. Only 'code' is supported (RFC 6749 Section 3.1.1).
  
   */
  response_type: string;
  /**
   * Space-delimited list of requested scopes (RFC 6749 Section 3.3).
  
   */
  scope?: string;
  /**
   * Opaque value used to maintain state between the request and callback (RFC 6749 Section 4.1.1).
  
   */
  state?: string;
  /**
   * String value used to associate a client session with an ID token (OpenID Connect Core Section 3.1.2.1).
  
   */
  nonce?: string;
  /**
   * PKCE code challenge derived from the code verifier (RFC 7636 Section 4.2).
  
   */
  code_challenge?: string;
  /**
   * Only S256 is supported. The plain method is not allowed.
  
   */
  code_challenge_method?: GetCode_challenge_method;
  /**
   * Resource indicator for the target service (RFC 8707).
  
   */
  resource?: string;
  /**
   * Space-delimited list of prompts to present to the user (OpenID Connect Core Section 3.1.2.1).
  
   */
  prompt?: string;
}
/**
 * Parameters for the oauth2LoginGet method.
    @property request_id (string) - The pending authorization request identifier.
  */
export interface Oauth2LoginGetParams {
  /**
   * The pending authorization request identifier.
  
   */
  request_id: string;
}

export interface Client {
  baseURL: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;
  /**
     Summary: Get public keys for JWT verification in JWK Set format
     Retrieve the JSON Web Key Set (JWKS) containing public keys used to verify JWT signatures. This endpoint is used by clients to validate access tokens.

     This method may return different T based on the response code:
     - 200: JWKSet
     */
  getJWKs(options?: RequestInit): Promise<FetchResponse<JWKSet>>;

  /**
     Summary: Elevate access for an already signed in user using FIDO2 Webauthn
     Generate a Webauthn challenge for elevating user permissions

     This method may return different T based on the response code:
     - 200: PublicKeyCredentialRequestOptions
     */
  elevateWebauthn(
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialRequestOptions>>;

  /**
     Summary: Verify FIDO2 Webauthn authentication using public-key cryptography for elevation
     Complete Webauthn elevation by verifying the authentication response

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  verifyElevateWebauthn(
    body: SignInWebauthnVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Health check (GET)
     Verify if the authentication service is operational using GET method

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  healthCheckGet(options?: RequestInit): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Health check (HEAD)
     Verify if the authentication service is operational using HEAD method

     This method may return different T based on the response code:
     - 200: void
     */
  healthCheckHead(options?: RequestInit): Promise<FetchResponse<void>>;

  /**
     Summary: Link a user account with the provider's account using an id token
     Link the authenticated user's account with an external OAuth provider account using an ID token. Requires elevated permissions.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  linkIdToken(
    body: LinkIdTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Generate TOTP secret
     Generate a Time-based One-Time Password (TOTP) secret for setting up multi-factor authentication

     This method may return different T based on the response code:
     - 200: TotpGenerateResponse
     */
  changeUserMfa(
    options?: RequestInit,
  ): Promise<FetchResponse<TotpGenerateResponse>>;

  /**
     Summary: Create a Personal Access Token (PAT)
     Generate a new Personal Access Token for programmatic API access. PATs are long-lived tokens that can be used instead of regular authentication for automated systems. Requires elevated permissions.

     This method may return different T based on the response code:
     - 200: CreatePATResponse
     */
  createPAT(
    body: CreatePATRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<CreatePATResponse>>;

  /**
     Summary: Sign in anonymously
     Create an anonymous user session without providing credentials. Anonymous users can be converted to regular users later via the deanonymize endpoint.

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  signInAnonymous(
    body?: SignInAnonymousRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Sign in with email and password
     Authenticate a user with their email and password. Returns a session object or MFA challenge if two-factor authentication is enabled.

     This method may return different T based on the response code:
     - 200: SignInEmailPasswordResponse
     */
  signInEmailPassword(
    body: SignInEmailPasswordRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SignInEmailPasswordResponse>>;

  /**
     Summary: Sign in with an ID token
     Authenticate using an ID token from a supported OAuth provider (Apple or Google). Creates a new user account if one doesn't exist.

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  signInIdToken(
    body: SignInIdTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Verify TOTP for MFA
     Complete the multi-factor authentication by verifying a Time-based One-Time Password (TOTP). Returns a session if validation is successful.

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  verifySignInMfaTotp(
    body: SignInMfaTotpRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Sign in with email OTP
     Initiate email-based one-time password authentication. Sends an OTP to the specified email address. If the user doesn't exist, a new account will be created with the provided options.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  signInOTPEmail(
    body: SignInOTPEmailRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Verify email OTP
     Complete email OTP authentication by verifying the one-time password. Returns a session if validation is successful.

     This method may return different T based on the response code:
     - 200: SignInOTPEmailVerifyResponse
     */
  verifySignInOTPEmail(
    body: SignInOTPEmailVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SignInOTPEmailVerifyResponse>>;

  /**
     Summary: Sign in with magic link email
     Initiate passwordless authentication by sending a magic link to the user's email. If the user doesn't exist, a new account will be created with the provided options.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  signInPasswordlessEmail(
    body: SignInPasswordlessEmailRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Sign in with SMS OTP
     Initiate passwordless authentication by sending a one-time password to the user's phone number. If the user doesn't exist, a new account will be created with the provided options.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  signInPasswordlessSms(
    body: SignInPasswordlessSmsRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Verify SMS OTP
     Complete passwordless SMS authentication by verifying the one-time password. Returns a session if validation is successful.

     This method may return different T based on the response code:
     - 200: SignInPasswordlessSmsOtpResponse
     */
  verifySignInPasswordlessSms(
    body: SignInPasswordlessSmsOtpRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SignInPasswordlessSmsOtpResponse>>;

  /**
     Summary: Sign in with Personal Access Token (PAT)
     Authenticate using a Personal Access Token. PATs are long-lived tokens that can be used for programmatic access to the API.

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  signInPAT(
    body: SignInPATRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Sign in with an OAuth2 provider
     Initiate OAuth2 authentication flow with a social provider. Redirects the user to the provider's authorization page.

     As this method is a redirect, it returns a URL string instead of a Promise
     */
  signInProviderURL(
    provider: SignInProvider,
    params?: SignInProviderParams,
    options?: RequestInit,
  ): string;

  /**
     Summary: Retrieve OAuth2 provider tokens from callback
     After successful OAuth2 authentication, retrieve the provider session containing access token, refresh token, and expiration information for the specified provider. To ensure the data isn't stale this endpoint must be called immediately after the OAuth callback to obtain the tokens. The session is cleared from the database during this call, so subsequent calls will fail without going through the sign-in flow again. It is the user's responsibility to store the session safely (e.g., in browser local storage).

     This method may return different T based on the response code:
     - 200: ProviderSession
     */
  getProviderTokens(
    provider: SignInProvider,
    options?: RequestInit,
  ): Promise<FetchResponse<ProviderSession>>;

  /**
     Summary: Sign in with Webauthn
     Initiate a Webauthn sign-in process by sending a challenge to the user's device. The user must have previously registered a Webauthn credential.

     This method may return different T based on the response code:
     - 200: PublicKeyCredentialRequestOptions
     */
  signInWebauthn(
    body?: SignInWebauthnRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialRequestOptions>>;

  /**
     Summary: Verify Webauthn sign-in
     Complete the Webauthn sign-in process by verifying the response from the user's device. Returns a session if validation is successful.

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  verifySignInWebauthn(
    body: SignInWebauthnVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Sign out
     End the current user session by invalidating refresh tokens. Optionally sign out from all devices.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  signOut(
    body: SignOutRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Sign up with email and password
     Register a new user account with email and password. Returns a session if email verification is not required, otherwise returns null session.

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  signUpEmailPassword(
    body: SignUpEmailPasswordRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Sign up with Webauthn
     Initiate a Webauthn sign-up process by sending a challenge to the user's device. The user must not have an existing account.

     This method may return different T based on the response code:
     - 200: PublicKeyCredentialCreationOptions
     */
  signUpWebauthn(
    body: SignUpWebauthnRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialCreationOptions>>;

  /**
     Summary: Verify Webauthn sign-up
     Complete the Webauthn sign-up process by verifying the response from the user's device. Returns a session if validation is successful.

     This method may return different T based on the response code:
     - 200: SessionPayload
     */
  verifySignUpWebauthn(
    body: SignUpWebauthnVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>>;

  /**
     Summary: Refresh access token
     Generate a new JWT access token using a valid refresh token. The refresh token used will be revoked and a new one will be issued.

     This method may return different T based on the response code:
     - 200: Session
     */
  refreshToken(
    body: RefreshTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<Session>>;

  /**
     Summary: Refresh OAuth2 provider tokens
     Refresh the OAuth2 provider access token using a valid refresh token. Returns a new provider session with updated access token, refresh token (if rotated by provider), and expiration information. This endpoint allows maintaining long-lived access to provider APIs without requiring the user to re-authenticate.

     This method may return different T based on the response code:
     - 200: ProviderSession
     */
  refreshProviderToken(
    provider: SignInProvider,
    body: RefreshProviderTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<ProviderSession>>;

  /**
     Summary: Verify JWT token
     Verify the validity of a JWT access token. If no request body is provided, the Authorization header will be used for verification.

     This method may return different T based on the response code:
     - 200: string
     */
  verifyToken(
    body?: VerifyTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<string>>;

  /**
     Summary: Get user information
     Retrieve the authenticated user's profile information including roles, metadata, and account status.

     This method may return different T based on the response code:
     - 200: User
     */
  getUser(options?: RequestInit): Promise<FetchResponse<User>>;

  /**
     Summary: Deanonymize an anonymous user
     Convert an anonymous user to a regular user by adding email and optionally password credentials. A confirmation email will be sent if the server is configured to do so.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  deanonymizeUser(
    body: UserDeanonymizeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Change user email
     Request to change the authenticated user's email address. A verification email will be sent to the new address to confirm the change. Requires elevated permissions.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  changeUserEmail(
    body: UserEmailChangeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Send verification email
     Send an email verification link to the specified email address. Used to verify email addresses for new accounts or email changes.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  sendVerificationEmail(
    body: UserEmailSendVerificationEmailRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Manage multi-factor authentication
     Activate or deactivate multi-factor authentication for the authenticated user

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  verifyChangeUserMfa(
    body: UserMfaRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Change user password
     Change the user's password. The user must be authenticated with elevated permissions or provide a valid password reset ticket.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  changeUserPassword(
    body: UserPasswordRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Request password reset
     Request a password reset for a user account. An email with a verification link will be sent to the user's email address to complete the password reset process.

     This method may return different T based on the response code:
     - 200: OKResponse
     */
  sendPasswordResetEmail(
    body: UserPasswordResetRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>>;

  /**
     Summary: Initialize adding of a new webauthn security key
     Start the process of adding a new WebAuthn security key to the user's account. Returns a challenge that must be completed by the user's authenticator device. Requires elevated permissions.

     This method may return different T based on the response code:
     - 200: PublicKeyCredentialCreationOptions
     */
  addSecurityKey(
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialCreationOptions>>;

  /**
     Summary: Verify adding of a new webauthn security key
     Complete the process of adding a new WebAuthn security key by verifying the authenticator response. Requires elevated permissions.

     This method may return different T based on the response code:
     - 200: VerifyAddSecurityKeyResponse
     */
  verifyAddSecurityKey(
    body: VerifyAddSecurityKeyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<VerifyAddSecurityKeyResponse>>;

  /**
     Summary: Verify email and authentication tickets
     Verify tickets created by email verification, magic link authentication, or password reset processes. Redirects the user to the appropriate destination upon successful verification.

     As this method is a redirect, it returns a URL string instead of a Promise
     */
  verifyTicketURL(params?: VerifyTicketParams, options?: RequestInit): string;

  /**
     Summary: Get service version
     Retrieve version information about the authentication service

     This method may return different T based on the response code:
     - 200: GetVersionResponse200
     */
  getVersion(
    options?: RequestInit,
  ): Promise<FetchResponse<GetVersionResponse200>>;

  /**
     Summary: OpenID Connect Discovery
     Returns the OpenID Provider Metadata (RFC 8414)

     This method may return different T based on the response code:
     - 200: OAuth2DiscoveryResponse
     */
  getOpenIDConfiguration(
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2DiscoveryResponse>>;

  /**
     Summary: OAuth2 Authorization Server Metadata
     Returns the Authorization Server Metadata (RFC 8414). Same content as OpenID Discovery.

     This method may return different T based on the response code:
     - 200: OAuth2DiscoveryResponse
     */
  getOAuthAuthorizationServer(
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2DiscoveryResponse>>;

  /**
     Summary: OAuth2 Authorization Endpoint
     Initiates an OAuth2 authorization code flow. Validates the request and redirects to the login UI for user authentication and consent.

     As this method is a redirect, it returns a URL string instead of a Promise
     */
  oauth2AuthorizeURL(
    params?: Oauth2AuthorizeParams,
    options?: RequestInit,
  ): string;

  /**
     Summary: OAuth2 Authorization Endpoint (POST)
     Initiates an OAuth2 authorization code flow via POST. Validates the request and redirects to the login UI for user authentication and consent.

     As this method is a redirect, it returns a URL string instead of a Promise
     */
  oauth2AuthorizePostURL(
    body: Oauth2AuthorizePostBody,
    options?: RequestInit,
  ): string;

  /**
     Summary: OAuth2 Token Endpoint
     Exchange an authorization code for tokens, or refresh an existing token. Supports grant_type authorization_code and refresh_token.

     This method may return different T based on the response code:
     - 200: OAuth2TokenResponse
     */
  oauth2Token(
    body: OAuth2TokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2TokenResponse>>;

  /**
     Summary: OpenID Connect UserInfo Endpoint (GET)
     Returns claims about the authenticated user based on the access token scopes.

     This method may return different T based on the response code:
     - 200: OAuth2UserinfoResponse
     */
  oauth2UserinfoGet(
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2UserinfoResponse>>;

  /**
     Summary: OpenID Connect UserInfo Endpoint (POST)
     Returns claims about the authenticated user based on the access token scopes.

     This method may return different T based on the response code:
     - 200: OAuth2UserinfoResponse
     */
  oauth2UserinfoPost(
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2UserinfoResponse>>;

  /**
     Summary: OAuth2 Provider JWKS Endpoint
     Returns the JSON Web Key Set containing public keys used for OAuth2/OIDC token signing.

     This method may return different T based on the response code:
     - 200: OAuth2JWKSResponse
     */
  oauth2Jwks(options?: RequestInit): Promise<FetchResponse<OAuth2JWKSResponse>>;

  /**
     Summary: OAuth2 Token Revocation (RFC 7009)
     Revoke an access token or refresh token.

     This method may return different T based on the response code:
     - 200: void
     */
  oauth2Revoke(
    body: OAuth2RevokeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<void>>;

  /**
     Summary: OAuth2 Token Introspection (RFC 7662)
     Introspect a token to determine its current state and metadata.

     This method may return different T based on the response code:
     - 200: OAuth2IntrospectResponse
     */
  oauth2Introspect(
    body: OAuth2IntrospectRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2IntrospectResponse>>;

  /**
     Summary: Get authorization request details for consent screen
     Called by the consent UI to get details about the pending authorization request.

     This method may return different T based on the response code:
     - 200: OAuth2LoginResponse
     */
  oauth2LoginGet(
    params?: Oauth2LoginGetParams,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2LoginResponse>>;

  /**
     Summary: Complete login/consent for an authorization request
     Called by the consent UI after user authenticates and consents. Sets the user on the auth request and redirects back to the client with an authorization code.

     This method may return different T based on the response code:
     - 200: OAuth2LoginCompleteResponse
     */
  oauth2LoginPost(
    body: OAuth2LoginRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2LoginCompleteResponse>>;
}

export const createAPIClient = (
  baseURL: string,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let fetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction);
    fetch = createEnhancedFetch(chainFunctions);
  };
  const getJWKs = async (
    options?: RequestInit,
  ): Promise<FetchResponse<JWKSet>> => {
    const url = `${baseURL}/.well-known/jwks.json`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: JWKSet = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<JWKSet>;
  };

  const elevateWebauthn = async (
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialRequestOptions>> => {
    const url = `${baseURL}/elevate/webauthn`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: PublicKeyCredentialRequestOptions = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<PublicKeyCredentialRequestOptions>;
  };

  const verifyElevateWebauthn = async (
    body: SignInWebauthnVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/elevate/webauthn/verify`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const healthCheckGet = async (
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/healthz`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const healthCheckHead = async (
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
    const url = `${baseURL}/healthz`;
    const res = await fetch(url, {
      ...options,
      method: 'HEAD',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const payload: undefined = undefined;

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<void>;
  };

  const linkIdToken = async (
    body: LinkIdTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/link/idtoken`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const changeUserMfa = async (
    options?: RequestInit,
  ): Promise<FetchResponse<TotpGenerateResponse>> => {
    const url = `${baseURL}/mfa/totp/generate`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: TotpGenerateResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<TotpGenerateResponse>;
  };

  const createPAT = async (
    body: CreatePATRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<CreatePATResponse>> => {
    const url = `${baseURL}/pat`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: CreatePATResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<CreatePATResponse>;
  };

  const signInAnonymous = async (
    body?: SignInAnonymousRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/signin/anonymous`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const signInEmailPassword = async (
    body: SignInEmailPasswordRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SignInEmailPasswordResponse>> => {
    const url = `${baseURL}/signin/email-password`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SignInEmailPasswordResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SignInEmailPasswordResponse>;
  };

  const signInIdToken = async (
    body: SignInIdTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/signin/idtoken`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const verifySignInMfaTotp = async (
    body: SignInMfaTotpRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/signin/mfa/totp`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const signInOTPEmail = async (
    body: SignInOTPEmailRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/signin/otp/email`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const verifySignInOTPEmail = async (
    body: SignInOTPEmailVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SignInOTPEmailVerifyResponse>> => {
    const url = `${baseURL}/signin/otp/email/verify`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SignInOTPEmailVerifyResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SignInOTPEmailVerifyResponse>;
  };

  const signInPasswordlessEmail = async (
    body: SignInPasswordlessEmailRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/signin/passwordless/email`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const signInPasswordlessSms = async (
    body: SignInPasswordlessSmsRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/signin/passwordless/sms`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const verifySignInPasswordlessSms = async (
    body: SignInPasswordlessSmsOtpRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SignInPasswordlessSmsOtpResponse>> => {
    const url = `${baseURL}/signin/passwordless/sms/otp`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SignInPasswordlessSmsOtpResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SignInPasswordlessSmsOtpResponse>;
  };

  const signInPAT = async (
    body: SignInPATRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/signin/pat`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const signInProviderURL = (
    provider: SignInProvider,
    params?: SignInProviderParams,
  ): string => {
    const encodedParameters =
      params &&
      Object.entries(params)
        .flatMap(([key, value]) => {
          if (key === 'providerSpecificParams') {
            // Object with explode: true - each property as separate parameter
            if (
              typeof value === 'object' &&
              value !== null &&
              !Array.isArray(value)
            ) {
              return Object.entries(value).map(
                ([k, v]) => `${k}=${encodeURIComponent(String(v))}`,
              );
            }
            return [`${key}=${encodeURIComponent(String(value))}`];
          }
          // Default handling (scalars or explode: false)
          const stringValue = Array.isArray(value)
            ? value.join(',')
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value);
          return [`${key}=${encodeURIComponent(stringValue)}`];
        })
        .join('&');

    const url = encodedParameters
      ? `${baseURL}/signin/provider/${provider}?${encodedParameters}`
      : `${baseURL}/signin/provider/${provider}`;
    return url;
  };

  const getProviderTokens = async (
    provider: SignInProvider,
    options?: RequestInit,
  ): Promise<FetchResponse<ProviderSession>> => {
    const url = `${baseURL}/signin/provider/${provider}/callback/tokens`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: ProviderSession = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<ProviderSession>;
  };

  const signInWebauthn = async (
    body?: SignInWebauthnRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialRequestOptions>> => {
    const url = `${baseURL}/signin/webauthn`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: PublicKeyCredentialRequestOptions = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<PublicKeyCredentialRequestOptions>;
  };

  const verifySignInWebauthn = async (
    body: SignInWebauthnVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/signin/webauthn/verify`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const signOut = async (
    body: SignOutRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/signout`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const signUpEmailPassword = async (
    body: SignUpEmailPasswordRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/signup/email-password`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const signUpWebauthn = async (
    body: SignUpWebauthnRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialCreationOptions>> => {
    const url = `${baseURL}/signup/webauthn`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: PublicKeyCredentialCreationOptions = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<PublicKeyCredentialCreationOptions>;
  };

  const verifySignUpWebauthn = async (
    body: SignUpWebauthnVerifyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<SessionPayload>> => {
    const url = `${baseURL}/signup/webauthn/verify`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: SessionPayload = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<SessionPayload>;
  };

  const refreshToken = async (
    body: RefreshTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<Session>> => {
    const url = `${baseURL}/token`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: Session = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<Session>;
  };

  const refreshProviderToken = async (
    provider: SignInProvider,
    body: RefreshProviderTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<ProviderSession>> => {
    const url = `${baseURL}/token/provider/${provider}`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: ProviderSession = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<ProviderSession>;
  };

  const verifyToken = async (
    body?: VerifyTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<string>> => {
    const url = `${baseURL}/token/verify`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: string = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<string>;
  };

  const getUser = async (
    options?: RequestInit,
  ): Promise<FetchResponse<User>> => {
    const url = `${baseURL}/user`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: User = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<User>;
  };

  const deanonymizeUser = async (
    body: UserDeanonymizeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/user/deanonymize`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const changeUserEmail = async (
    body: UserEmailChangeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/user/email/change`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const sendVerificationEmail = async (
    body: UserEmailSendVerificationEmailRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/user/email/send-verification-email`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const verifyChangeUserMfa = async (
    body: UserMfaRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/user/mfa`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const changeUserPassword = async (
    body: UserPasswordRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/user/password`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const sendPasswordResetEmail = async (
    body: UserPasswordResetRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OKResponse>> => {
    const url = `${baseURL}/user/password/reset`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OKResponse = responseBody ? JSON.parse(responseBody) : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OKResponse>;
  };

  const addSecurityKey = async (
    options?: RequestInit,
  ): Promise<FetchResponse<PublicKeyCredentialCreationOptions>> => {
    const url = `${baseURL}/user/webauthn/add`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: PublicKeyCredentialCreationOptions = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<PublicKeyCredentialCreationOptions>;
  };

  const verifyAddSecurityKey = async (
    body: VerifyAddSecurityKeyRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<VerifyAddSecurityKeyResponse>> => {
    const url = `${baseURL}/user/webauthn/verify`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: VerifyAddSecurityKeyResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<VerifyAddSecurityKeyResponse>;
  };

  const verifyTicketURL = (params?: VerifyTicketParams): string => {
    const encodedParameters =
      params &&
      Object.entries(params)
        .flatMap(([key, value]) => {
          // Default handling (scalars or explode: false)
          const stringValue = Array.isArray(value)
            ? value.join(',')
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value);
          return [`${key}=${encodeURIComponent(stringValue)}`];
        })
        .join('&');

    const url = encodedParameters
      ? `${baseURL}/verify?${encodedParameters}`
      : `${baseURL}/verify`;
    return url;
  };

  const getVersion = async (
    options?: RequestInit,
  ): Promise<FetchResponse<GetVersionResponse200>> => {
    const url = `${baseURL}/version`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: GetVersionResponse200 = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<GetVersionResponse200>;
  };

  const getOpenIDConfiguration = async (
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2DiscoveryResponse>> => {
    const url = `${baseURL}/.well-known/openid-configuration`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2DiscoveryResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2DiscoveryResponse>;
  };

  const getOAuthAuthorizationServer = async (
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2DiscoveryResponse>> => {
    const url = `${baseURL}/.well-known/oauth-authorization-server`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2DiscoveryResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2DiscoveryResponse>;
  };

  const oauth2AuthorizeURL = (params?: Oauth2AuthorizeParams): string => {
    const encodedParameters =
      params &&
      Object.entries(params)
        .flatMap(([key, value]) => {
          // Default handling (scalars or explode: false)
          const stringValue = Array.isArray(value)
            ? value.join(',')
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value);
          return [`${key}=${encodeURIComponent(stringValue)}`];
        })
        .join('&');

    const url = encodedParameters
      ? `${baseURL}/oauth2/authorize?${encodedParameters}`
      : `${baseURL}/oauth2/authorize`;
    return url;
  };

  const oauth2AuthorizePostURL = (): string => {
    const url = `${baseURL}/oauth2/authorize`;
    return url;
  };

  const oauth2Token = async (
    body: OAuth2TokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2TokenResponse>> => {
    const url = `${baseURL}/oauth2/token`;
    const params = new URLSearchParams();
    if (body['grant_type'] !== undefined) {
      params.append('grant_type', String(body['grant_type']));
    }
    if (body['code'] !== undefined) {
      params.append('code', String(body['code']));
    }
    if (body['redirect_uri'] !== undefined) {
      params.append('redirect_uri', String(body['redirect_uri']));
    }
    if (body['client_id'] !== undefined) {
      params.append('client_id', String(body['client_id']));
    }
    if (body['client_secret'] !== undefined) {
      params.append('client_secret', String(body['client_secret']));
    }
    if (body['code_verifier'] !== undefined) {
      params.append('code_verifier', String(body['code_verifier']));
    }
    if (body['refresh_token'] !== undefined) {
      params.append('refresh_token', String(body['refresh_token']));
    }
    if (body['resource'] !== undefined) {
      params.append('resource', String(body['resource']));
    }

    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options?.headers,
      },
      body: params.toString(),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2TokenResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2TokenResponse>;
  };

  const oauth2UserinfoGet = async (
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2UserinfoResponse>> => {
    const url = `${baseURL}/oauth2/userinfo`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2UserinfoResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2UserinfoResponse>;
  };

  const oauth2UserinfoPost = async (
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2UserinfoResponse>> => {
    const url = `${baseURL}/oauth2/userinfo`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2UserinfoResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2UserinfoResponse>;
  };

  const oauth2Jwks = async (
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2JWKSResponse>> => {
    const url = `${baseURL}/oauth2/jwks`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2JWKSResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2JWKSResponse>;
  };

  const oauth2Revoke = async (
    body: OAuth2RevokeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
    const url = `${baseURL}/oauth2/revoke`;
    const params = new URLSearchParams();
    if (body['token'] !== undefined) {
      params.append('token', String(body['token']));
    }
    if (body['token_type_hint'] !== undefined) {
      params.append('token_type_hint', String(body['token_type_hint']));
    }
    if (body['client_id'] !== undefined) {
      params.append('client_id', String(body['client_id']));
    }
    if (body['client_secret'] !== undefined) {
      params.append('client_secret', String(body['client_secret']));
    }

    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options?.headers,
      },
      body: params.toString(),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const payload: undefined = undefined;

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<void>;
  };

  const oauth2Introspect = async (
    body: OAuth2IntrospectRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2IntrospectResponse>> => {
    const url = `${baseURL}/oauth2/introspect`;
    const params = new URLSearchParams();
    if (body['token'] !== undefined) {
      params.append('token', String(body['token']));
    }
    if (body['token_type_hint'] !== undefined) {
      params.append('token_type_hint', String(body['token_type_hint']));
    }
    if (body['client_id'] !== undefined) {
      params.append('client_id', String(body['client_id']));
    }
    if (body['client_secret'] !== undefined) {
      params.append('client_secret', String(body['client_secret']));
    }

    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options?.headers,
      },
      body: params.toString(),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2IntrospectResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2IntrospectResponse>;
  };

  const oauth2LoginGet = async (
    params?: Oauth2LoginGetParams,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2LoginResponse>> => {
    const encodedParameters =
      params &&
      Object.entries(params)
        .flatMap(([key, value]) => {
          // Default handling (scalars or explode: false)
          const stringValue = Array.isArray(value)
            ? value.join(',')
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value);
          return [`${key}=${encodeURIComponent(stringValue)}`];
        })
        .join('&');

    const url = encodedParameters
      ? `${baseURL}/oauth2/login?${encodedParameters}`
      : `${baseURL}/oauth2/login`;
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2LoginResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2LoginResponse>;
  };

  const oauth2LoginPost = async (
    body: OAuth2LoginRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<OAuth2LoginCompleteResponse>> => {
    const url = `${baseURL}/oauth2/login`;
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }

    const responseBody = [204, 205, 304].includes(res.status)
      ? null
      : await res.text();
    const payload: OAuth2LoginCompleteResponse = responseBody
      ? JSON.parse(responseBody)
      : {};

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<OAuth2LoginCompleteResponse>;
  };

  return {
    baseURL,
    pushChainFunction,
    getJWKs,
    elevateWebauthn,
    verifyElevateWebauthn,
    healthCheckGet,
    healthCheckHead,
    linkIdToken,
    changeUserMfa,
    createPAT,
    signInAnonymous,
    signInEmailPassword,
    signInIdToken,
    verifySignInMfaTotp,
    signInOTPEmail,
    verifySignInOTPEmail,
    signInPasswordlessEmail,
    signInPasswordlessSms,
    verifySignInPasswordlessSms,
    signInPAT,
    signInProviderURL,
    getProviderTokens,
    signInWebauthn,
    verifySignInWebauthn,
    signOut,
    signUpEmailPassword,
    signUpWebauthn,
    verifySignUpWebauthn,
    refreshToken,
    refreshProviderToken,
    verifyToken,
    getUser,
    deanonymizeUser,
    changeUserEmail,
    sendVerificationEmail,
    verifyChangeUserMfa,
    changeUserPassword,
    sendPasswordResetEmail,
    addSecurityKey,
    verifyAddSecurityKey,
    verifyTicketURL,
    getVersion,
    getOpenIDConfiguration,
    getOAuthAuthorizationServer,
    oauth2AuthorizeURL,
    oauth2AuthorizePostURL,
    oauth2Token,
    oauth2UserinfoGet,
    oauth2UserinfoPost,
    oauth2Jwks,
    oauth2Revoke,
    oauth2Introspect,
    oauth2LoginGet,
    oauth2LoginPost,
  };
};
