import { jwtDecode } from 'jwt-decode'
import { interpret } from 'xstate'
import {
  EMAIL_NEEDS_VERIFICATION,
  INVALID_REFRESH_TOKEN,
  INVALID_SIGN_IN_METHOD,
  NO_REFRESH_TOKEN,
  TOKEN_REFRESHER_RUNNING_ERROR
} from './errors'
import { AuthClient } from './internal-client'
import {
  AuthInterpreter,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine
} from './machines'
import {
  addSecurityKeyPromise,
  changeEmailPromise,
  changePasswordPromise,
  elevateEmailSecurityKeyPromise,
  resetPasswordPromise,
  sendVerificationEmailPromise,
  signInAnonymousPromise,
  signInEmailOTPPromise,
  signInEmailPasswordlessPromise,
  signInEmailPasswordPromise,
  signInEmailSecurityKeyPromise,
  signInMfaTotpPromise,
  signInPATPromise,
  signInSecurityKeyPromise,
  signInSmsPasswordlessOtpPromise,
  signInSmsPasswordlessPromise,
  signOutPromise,
  signUpEmailPasswordPromise,
  signUpEmailSecurityKeyPromise,
  verifyEmailOTPPromise
} from './promises'
import { createPATPromise } from './promises/createPAT'
import { linkIdTokenPromise } from './promises/linkIdToken'
import { signInIdTokenPromise } from './promises/signInIdToken'
import {
  AuthChangedFunction,
  AuthErrorPayload,
  ChangeEmailParams,
  ChangeEmailResponse,
  ChangePasswordParams,
  ChangePasswordResponse,
  ConnectProviderParams,
  ConnectProviderResponse,
  DeanonymizeParams,
  DeanonymizeResponse,
  EmailOTPOptions,
  JWTClaims,
  JWTHasuraClaims,
  LinkIdTokenParams,
  NhostAuthConstructorParams,
  NhostSession,
  NhostSessionResponse,
  OnTokenChangedFunction,
  RequestOptions,
  ResetPasswordParams,
  ResetPasswordResponse,
  SecurityKey,
  SendVerificationEmailParams,
  SendVerificationEmailResponse,
  SignInIdTokenParams,
  SignInParams,
  SignInPATResponse,
  SignInResponse,
  SignOutResponse,
  SignUpParams,
  SignUpResponse
} from './types'
import {
  encodeQueryParameters,
  getAuthenticationResult,
  getSession,
  isBrowser,
  rewriteRedirectTo
} from './utils'

/**
 * @alias Auth
 */
export class HasuraAuthClient {
  private _client: AuthClient
  readonly url: string
  constructor({
    url,
    broadcastKey,
    autoRefreshToken = true,
    autoSignIn = true,
    clientStorage,
    clientStorageType,
    refreshIntervalTime,
    start = true
  }: NhostAuthConstructorParams) {
    this.url = url
    this._client = new AuthClient({
      backendUrl: url,
      clientUrl: (typeof window !== 'undefined' && window.location?.origin) || '',
      broadcastKey,
      autoRefreshToken,
      autoSignIn,
      start,
      clientStorage,
      clientStorageType,
      refreshIntervalTime
    })
  }

  /**
   * Use `nhost.auth.signUp` to sign up a user using email and password. If you want to sign up a user using passwordless email (Magic Link), SMS, or an OAuth provider, use the `signIn` function instead.
   *
   * @example
   * ### Sign up with an email and password
   * ```ts
   * nhost.auth.signUp({
   *   email: 'joe@example.com',
   *   password: 'secret-password'
   * })
   * ```
   *
   * @example
   * ### Sign up with a security key
   * ```ts
   * nhost.auth.signUp({
   *   email: 'joe@example.com',
   *   securityKey: true
   * })
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-up
   */
  async signUp(params: SignUpParams, requestOptions?: RequestOptions): Promise<SignUpResponse> {
    const interpreter = await this.waitUntilReady()

    if ('securityKey' in params) {
      const { email, options } = params
      return getAuthenticationResult(
        await signUpEmailSecurityKeyPromise(interpreter, email, options, requestOptions)
      )
    }
    const { email, password, options } = params
    return getAuthenticationResult(
      await signUpEmailPasswordPromise(interpreter, email, password, options, requestOptions)
    )
  }

  /**
   * Use `nhost.auth.connectProvider` to connect a social authentication provider to an existing user account
   *
   * @example
   * ### Connect an authentication provider to an existing user account
   * ```ts
   * nhost.auth.connectProvider({
   *   provider: 'github
   *   options: {
   *    redirectTo: window.location.href
   *   }
   * })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/connect-provider
   */
  async connectProvider(params: ConnectProviderParams): Promise<ConnectProviderResponse> {
    const interpreter = await this.waitUntilReady()
    const accessToken = interpreter.getSnapshot().context.accessToken.value

    const { provider, options } = params

    const providerUrl = encodeQueryParameters(
      `${this._client.backendUrl}/signin/provider/${provider}`,
      rewriteRedirectTo(this._client.clientUrl, {
        ...options,
        connect: accessToken
      } as any)
    )
    if (isBrowser()) {
      window.location.href = providerUrl
    }

    return { providerUrl }
  }

  /**
   * Use `nhost.auth.signInIdToken` to sign in a user with the provider's account using an ID token
   *
   * @example
   * ### Sign in a user with an id token
   * ```ts
   * nhost.auth.signInIdToken({
   *   provider: 'google', // The provider name, e.g., 'google', 'apple', etc.
   *   idToken: '...', // The ID token issued by the provider.
   *   nonce: '...', // Optional: The nonce used during token generation.
   * });
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-in-idtoken
   */
  async signInIdToken(params: SignInIdTokenParams) {
    const interpreter = await this.waitUntilReady()

    const res = await signInIdTokenPromise(interpreter, params)

    return { ...getAuthenticationResult(res), mfa: null }
  }

  /**
   * Use `nhost.auth.linkIdToken` to link a user account with the provider's account using an ID token
   *
   * @example
   * ### Link a user account with the provider's account using an id token
   * ```ts
   * nhost.auth.linkIdToken({
   *   provider: 'google', // The provider name, e.g., 'google', 'apple', etc.
   *   idToken: '...', // The ID token issued by the provider.
   *   nonce: '...', // Optional: The nonce used during token generation.
   * })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/link-idtoken
   */
  async linkIdToken(params: LinkIdTokenParams) {
    return linkIdTokenPromise(this._client, params)
  }

  /**
   * Use `nhost.auth.signIn` to sign in a user using email and password, passwordless (email or sms) or an external provider. `signIn` can be used to sign in a user in various ways depending on the parameters.
   *
   * @example
   * ### Sign in a user using email and password
   * ```ts
   * nhost.auth.signIn({
   *   email: 'joe@example.com',
   *   password: 'secret-password'
   * })
   * ```
   *
   * @example
   * ### Sign in a user using an OAuth provider (e.g: Google or Facebook)
   * ```ts
   * nhost.auth.signIn({ provider: 'google' })
   * ```
   *
   * @example
   * ### Sign in a user using passwordless email (Magic Link)
   * ```ts
   * nhost.auth.signIn({ email: 'joe@example.com' })
   * ```
   *
   * @example
   * ### Sign in a user using passwordless SMS
   * ```ts
   * // [step 1/2] Passwordless sign in using SMS
   * nhost.auth.signIn({ phoneNumber: '+11233213123' })
   *
   * // [step 2/2] Finish passwordless sign in using SMS (OTP)
   * nhost.auth.signIn({ phoneNumber: '+11233213123', otp: '123456' })
   * ```
   *
   * @example
   * ### Sign in anonymously
   * ```ts
   * // Sign in anonymously
   * nhost.auth.signIn()
   *
   * // Later in the application, the user can complete their registration
   * nhost.auth.signUp({
   *   email: 'joe@example.com',
   *   password: 'secret-password'
   * })
   * ```
   *
   * @example
   * ### Sign in with a security key
   * ```ts
   * nhost.auth.signIn({
   *   email: 'joe@example.com',
   *   securityKey: true
   * })
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-in
   */
  async signIn(
    params?: SignInParams
  ): Promise<SignInResponse & { providerUrl?: string; provider?: string }> {
    const interpreter = await this.waitUntilReady()
    // * Anonymous sign-in
    if (!params) {
      const anonymousResult = await signInAnonymousPromise(interpreter)
      return { ...getAuthenticationResult(anonymousResult), mfa: null }
    }

    // * Sign in with a social provider (OAuth)
    if ('provider' in params) {
      const { provider, options } = params
      const providerUrl = encodeQueryParameters(
        `${this._client.backendUrl}/signin/provider/${provider}`,
        rewriteRedirectTo(this._client.clientUrl, options as any)
      )
      if (isBrowser()) {
        window.location.href = providerUrl
      }
      return { providerUrl, provider, session: null, mfa: null, error: null }
    }

    // * Email + password
    if ('email' in params && 'password' in params) {
      const res = await signInEmailPasswordPromise(interpreter, params.email, params.password)
      if (res.needsEmailVerification) {
        return { session: null, mfa: null, error: EMAIL_NEEDS_VERIFICATION }
      }
      if (res.needsMfaOtp) {
        return {
          session: null,
          mfa: res.mfa,
          error: null
        }
      }
      return { ...getAuthenticationResult(res), mfa: null }
    }

    if ('email' in params && 'securityKey' in params) {
      if (params.securityKey !== true) {
        throw Error('securityKey must be true')
      }
      const res = await signInEmailSecurityKeyPromise(interpreter, params.email)
      return { ...getAuthenticationResult(res), mfa: null }
    }

    // * Passwordless Email (magic link)
    if ('email' in params) {
      const { email, options } = params
      const { error } = await signInEmailPasswordlessPromise(interpreter, email, options)
      return {
        session: null,
        mfa: null,
        error
      }
    }

    // * Passwordless SMS: [step 2/2] sign in using SMS OTP
    if ('phoneNumber' in params && 'otp' in params) {
      const res = await signInSmsPasswordlessOtpPromise(interpreter, params.phoneNumber, params.otp)
      return { ...getAuthenticationResult(res), mfa: null }
    }

    // * Passwordless SMS: [step 1/2] sign in using SMS
    if ('phoneNumber' in params) {
      const { error } = await signInSmsPasswordlessPromise(
        interpreter,
        params.phoneNumber,
        params.options
      )
      return { error, mfa: null, session: null }
    }

    // * Email + password MFA TOTP
    if ('otp' in params) {
      const res = await signInMfaTotpPromise(interpreter, params.otp, params.ticket)
      return { ...getAuthenticationResult(res), mfa: null }
    }

    return { error: INVALID_SIGN_IN_METHOD, mfa: null, session: null }
  }

  /**
   * Use `nhost.auth.signInPAT` to sign in with a personal access token (PAT).
   *
   * @example
   * ```ts
   * nhost.auth.signInPAT('34f74930-09c0-4af5-a8d5-28fad78e3415')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-in-pat
   *
   * @param personalAccessToken - The personal access token to sign in with
   */
  async signInPAT(personalAccessToken: string): Promise<SignInPATResponse> {
    const interpreter = await this.waitUntilReady()
    const res = await signInPATPromise(interpreter, personalAccessToken)

    return getAuthenticationResult(res)
  }

  /**
   * Use `nhost.auth.signInEmailOTP` to sign in with an email one-time password (OTP).
   *
   * @example
   * ```ts
   * nhost.auth.signInEmailOTP('user@example.com')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-in-email-otp
   *
   * @param email - The email address to send the OTP to
   */
  async signInEmailOTP(email: string, options?: EmailOTPOptions): Promise<SignInResponse> {
    const interpreter = await this.waitUntilReady()

    const { error } = await signInEmailOTPPromise(interpreter, email, options)

    return {
      error,
      session: null,
      mfa: null
    }
  }

  /**
   * Use `nhost.auth.verifyEmailOTP` to verify an email one-time password (OTP) and complete the sign-in process
   *
   * @example
   * ```ts
   * nhost.auth.verifyEmailOTP('user@example.com', '123456')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/verify-email-otp
   *
   * @param email - The email address to verify the OTP for
   * @param otp - The one-time password sent to the email address
   */
  async verifyEmailOTP(email: string, otp: string): Promise<SignInResponse> {
    const interpreter = await this.waitUntilReady()

    const res = await verifyEmailOTPPromise(interpreter, email, otp)

    return { ...getAuthenticationResult(res), mfa: null }
  }

  /**
   * Use `nhost.auth.signInSecurityKey` to sign in a user with a security key using the WebAuthn API
   *
   * @example
   * ```ts
   * nhost.auth.signInSecurityKey()
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-in-security-key
   */
  async signInSecurityKey(): Promise<SignInResponse> {
    const interpreter = await this.waitUntilReady()

    const res = await signInSecurityKeyPromise(interpreter)

    return { ...getAuthenticationResult(res), mfa: null }
  }

  /**
   * Use `nhost.auth.signOut` to sign out the user.
   *
   * @example
   * ### Sign out the user from current device
   * ```ts
   * nhost.auth.signOut()
   * ```
   *
   * @example
   * ### Sign out the user from all devices
   * ```ts
   * nhost.auth.signOut({all: true})
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-out
   */
  async signOut(params?: { all?: boolean }): Promise<SignOutResponse> {
    const interpreter = await this.waitUntilReady()
    const { error } = await signOutPromise(interpreter, params?.all)
    return { error }
  }

  /**
   * Use `nhost.auth.resetPassword` to reset the password for a user. This will send a reset-password link in an email to the user. When the user clicks the reset-password link the user is automatically signed-in. Once signed-in, the user can change their password using `nhost.auth.changePassword()`.
   *
   * @example
   * ```ts
   * nhost.auth.resetPassword({email: 'joe@example.com' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/reset-password
   */
  async resetPassword({ email, options }: ResetPasswordParams): Promise<ResetPasswordResponse> {
    const service = interpret(createResetPasswordMachine(this._client)).start()
    const { error } = await resetPasswordPromise(service, email, options)
    return { error }
  }

  /**
   * Use `nhost.auth.changePassword` to change the password for the signed-in user. The old password is not needed. In case the user is not signed-in, a password reset ticket needs to be provided.
   *
   * @example
   * ```ts
   * nhost.auth.changePassword({ newPassword: 'new-secret-password' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/change-password
   */
  async changePassword({
    newPassword,
    ticket
  }: ChangePasswordParams): Promise<ChangePasswordResponse> {
    const service = interpret(createChangePasswordMachine(this._client)).start()
    const { error } = await changePasswordPromise(service, newPassword, ticket)
    return { error }
  }

  /**
   * Use `nhost.auth.sendVerificationEmail` to send a verification email to the specified email. The email contains a verification-email link. When the user clicks the verification-email link their email is verified.
   *
   * @example
   * ```ts
   * nhost.auth.sendVerificationEmail({ email: 'joe@example.com' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/send-verification-email
   */
  async sendVerificationEmail({
    email,
    options
  }: SendVerificationEmailParams): Promise<SendVerificationEmailResponse> {
    const service = interpret(createSendVerificationEmailMachine(this._client)).start()
    const { error } = await sendVerificationEmailPromise(service, email, options)
    return { error }
  }

  /**
   * Use `nhost.auth.changeEmail` to change a user's email. This will send a confirm-email-change link in an email to the new email. Once the user clicks on the confirm-email-change link the email will be change to the new email.
   *
   * @example
   * ```ts
   * nhost.auth.changeEmail({ newEmail: 'doe@example.com' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/change-email
   */
  async changeEmail({ newEmail, options }: ChangeEmailParams): Promise<ChangeEmailResponse> {
    const service = interpret(createChangeEmailMachine(this._client)).start()
    const { error } = await changeEmailPromise(service, newEmail, options)
    return { error }
  }

  /**
   * Use `nhost.auth.deanonymize` to deanonymize a user.
   *
   * @example
   * ```ts
   * nhost.auth.deanonymize({signInMethod: 'email-password', email: 'joe@example.com' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/deanonymize
   */
  async deanonymize(params: DeanonymizeParams): Promise<DeanonymizeResponse> {
    const interpreter = await this.waitUntilReady()
    if (params.signInMethod === 'passwordless') {
      if (params.connection === 'email') {
        const { error } = await signInEmailPasswordlessPromise(
          interpreter,
          params.email,
          params.options
        )
        return { error }
      }
      if (params.connection === 'sms') {
        const { error } = await signInSmsPasswordlessPromise(
          interpreter,
          params.phoneNumber,
          params.options
        )
        return { error }
      }
    }
    if (params.signInMethod === 'email-password') {
      const { error } = await signUpEmailPasswordPromise(
        interpreter,
        params.email,
        params.password,
        params.options
      )
      return { error }
    }
    throw Error(`Unknown deanonymization method`)
  }

  /**
   * Use `nhost.auth.addSecurityKey` to add a security key to the user, using the WebAuthn API.
   * @param nickname optional human-readable nickname for the security key
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/add-security-key
   */
  async addSecurityKey(
    nickname?: string
  ): Promise<{ error: AuthErrorPayload | null; key?: SecurityKey }> {
    const { error, key } = await addSecurityKeyPromise(this._client, nickname)
    return { error, key }
  }

  /**
   * Use `nhost.auth.elevateEmailSecurityKey` to get a temporary elevated auth permissions to run sensitive operations.
   * @param email user email
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/elevate-email-security-key
   */
  async elevateEmailSecurityKey(email: string) {
    if (!email) {
      throw Error('A user email is required')
    }

    const res = await elevateEmailSecurityKeyPromise(this._client, email)

    return { ...res, mfa: null }
  }

  /**
   * Use `nhost.auth.createPAT` to create a personal access token for the user.
   *
   * @param expiresAt Expiration date for the token
   * @param metadata Optional metadata to store with the token
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/create-pat
   */
  async createPAT(expiresAt: Date, metadata?: Record<string, string | number>) {
    return createPATPromise(this._client, { expiresAt, metadata })
  }

  /**
   * Use `nhost.auth.onTokenChanged` to add a custom function that runs every time the access or refresh token is changed.
   *
   *
   * @example
   * ```ts
   * nhost.auth.onTokenChanged(() => console.log('The access and refresh token has changed'));
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/on-token-changed
   */
  onTokenChanged(fn: OnTokenChangedFunction): Function {
    return this._client.subscribe(() => {
      const subscription = this._client.interpreter?.onTransition(({ event, context }) => {
        if (event.type === 'TOKEN_CHANGED') {
          fn(getSession(context))
        }
      })
      return () => subscription?.stop()
    })
  }

  /**
   * Use `nhost.auth.onAuthStateChanged` to add a custom function that runs every time the authentication status of the user changes. E.g. add a custom function that runs every time the authentication status changes from signed-in to signed-out.
   *
   * @example
   * ```ts
   * nhost.auth.onAuthStateChanged((event, session) => {
   *   console.log(`The auth state has changed. State is now ${event} with session: ${session}`)
   * });
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/on-auth-state-changed
   */
  onAuthStateChanged(fn: AuthChangedFunction): Function {
    return this._client.subscribe(() => {
      const subscription = this._client.interpreter?.onTransition(({ event, context }) => {
        if (event.type === 'SIGNED_IN' || event.type === 'SIGNED_OUT') {
          fn(event.type, getSession(context))
        }
      })
      return () => subscription?.stop()
    })
  }

  /**
   * Use `nhost.auth.isAuthenticated` to check if the user is authenticated or not.
   *
   * Note: `nhost.auth.isAuthenticated()` can return `false` for two reasons:
   * 1. The user is not authenticated
   * 2. The user is not authenticated but _might_ be authenticated soon (loading) because there is a network request in transit.
   *
   * Use `nhost.auth.getAuthenticationStatus` to get both authentication and loading status.
   *
   * @example
   * ```ts
   * const isAuthenticated = nhost.auth.isAuthenticated();
   *
   * if (isAuthenticated) {
   *   console.log('User is authenticated');
   * }
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/is-authenticated
   */
  isAuthenticated(): boolean {
    return !!this._client.interpreter?.getSnapshot().matches({ authentication: 'signedIn' })
  }

  /**
   * Use `nhost.auth.isAuthenticatedAsync` to wait (await) for any internal authentication network requests to finish and then return the authentication status.
   *
   * The promise won't resolve until the authentication status is known.
   * Attention: when using auto-signin and a refresh token is present in the client storage, the promise won't resolve if the server can't be reached (e.g. offline) or if it returns an internal error.
   *
   * @example
   * ```ts
   * const isAuthenticated  = await nhost.auth.isAuthenticatedAsync();
   *
   * if (isAuthenticated) {
   *   console.log('User is authenticated');
   * }
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/is-authenticated-async
   */
  async isAuthenticatedAsync(): Promise<boolean> {
    const interpreter = await this.waitUntilReady()
    return interpreter.getSnapshot().matches({ authentication: 'signedIn' })
  }

  /**
   * Use `nhost.auth.getAuthenticationStatus` to get the authentication status of the user.
   *
   * If `isLoading` is `true`, the client doesn't know whether the user is authenticated yet or not
   * because some internal authentication network requests have not been resolved yet.
   *
   * The `connectionAttempts` returns the number of times the client has tried to connect to the server with no success (offline, or the server retruned an internal error).
   *
   * @example
   * ```ts
   * const { isAuthenticated, isLoading } = nhost.auth.getAuthenticationStatus();
   *
   * if (isLoading) {
   *   console.log('Loading...')
   * }
   *
   * if (isAuthenticated) {
   *   console.log('User is authenticated');
   * }
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-authentication-status
   */
  getAuthenticationStatus(): {
    isAuthenticated: boolean
    isLoading: boolean
    connectionAttempts: number
  } {
    const connectionAttempts =
      this.client.interpreter?.getSnapshot().context.importTokenAttempts || 0
    if (!this.isReady()) {
      return {
        isAuthenticated: false,
        isLoading: true,
        connectionAttempts
      }
    }
    return { isAuthenticated: this.isAuthenticated(), isLoading: false, connectionAttempts }
  }

  /**
   * Use `nhost.auth.getAccessToken` to get the access token of the user.
   *
   * @example
   * ```ts
   * const accessToken = nhost.auth.getAccessToken();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-access-token
   */
  getAccessToken(): string | undefined {
    return this._client.interpreter?.getSnapshot().context.accessToken.value ?? undefined
  }

  /**
   * Use `nhost.auth.getDecodedAccessToken` to get the decoded access token of the user.
   *
   * @example
   * ```ts
   * const decodedAccessToken = nhost.auth.getDecodedAccessToken();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-decoded-access-token
   */
  public getDecodedAccessToken(): JWTClaims | null {
    const jwt = this.getAccessToken()
    if (!jwt) return null
    return jwtDecode<JWTClaims>(jwt)
  }

  /**
   * Use `nhost.auth.getHasuraClaims` to get the Hasura claims of the user.
   *
   * @example
   * ```ts
   * const hasuraClaims = nhost.auth.getHasuraClaims();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-hasura-claims
   */
  public getHasuraClaims(): JWTHasuraClaims | null {
    return this.getDecodedAccessToken()?.['https://hasura.io/jwt/claims'] || null
  }

  /**
   * Use `nhost.auth.getHasuraClaim` to get the value of a specific Hasura claim of the user.
   *
   * @example
   * ```ts
   * // if `x-hasura-company-id` exists as a custom claim
   * const companyId = nhost.auth.getHasuraClaim('company-id')
   * ```
   *
   * @param name Name of the variable. You don't have to specify `x-hasura-`.
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-hasura-claim
   */
  public getHasuraClaim(name: string): string | string[] | null {
    return (
      this.getHasuraClaims()?.[name.startsWith('x-hasura-') ? name : `x-hasura-${name}`] || null
    )
  }

  /**
   *
   * Use `nhost.auth.refreshSession` to refresh the session with either the current internal refresh token or an external refresh token.
   *
   * Note: The Nhost client automatically refreshes the session when the user is authenticated but `nhost.auth.refreshSession` can be useful in some special cases.
   *
   * @example
   * ```ts
   * // Refresh the session with the the current internal refresh token.
   * nhost.auth.refreshSession();
   *
   * // Refresh the session with an external refresh token.
   * nhost.auth.refreshSession(refreshToken);
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/refresh-session
   */
  async refreshSession(refreshToken?: string): Promise<NhostSessionResponse> {
    try {
      const interpreter = await this.waitUntilReady()
      return new Promise((resolve) => {
        const token = refreshToken || interpreter.getSnapshot().context.refreshToken.value
        if (!token) {
          return resolve({ session: null, error: NO_REFRESH_TOKEN })
        }
        const { changed } = interpreter.send('TRY_TOKEN', { token })
        if (!changed) {
          return resolve({ session: null, error: TOKEN_REFRESHER_RUNNING_ERROR })
        }
        interpreter.onTransition((state) => {
          if (state.matches({ token: { idle: 'error' } })) {
            resolve({
              session: null,
              // * TODO get the error from xstate once it is implemented
              error: INVALID_REFRESH_TOKEN
            })
          } else if (state.event.type === 'TOKEN_CHANGED') {
            resolve({ session: getSession(state.context), error: null })
          }
        })
      })
    } catch (error: any) {
      // TODO return error in the correct format
      return { session: null, error: error.message }
    }
  }

  /**
   *
   * Use `nhost.auth.getSession()` to get the session of the user.
   *
   * @example
   * ```ts
   * const session = nhost.auth.getSession();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-session
   */
  getSession() {
    return getSession(this._client.interpreter?.getSnapshot()?.context)
  }

  /**
   * Initialize the auth client with an existing session
   *
   * @example
   * ### Initialize with an existing Nhost session
   * ```ts
   * await nhost.auth.initWithSession({ session: initialSession })
   * ```
   *
   * @param session - The Nhost session object to initialize the client with
   * @docs https://docs.nhost.io/reference/javascript/auth/init-with-session
   */
  async initWithSession({ session }: { session: NhostSession }): Promise<void> {
    this.client.start({ initialSession: session })
    await this.waitUntilReady()
  }

  /**
   *
   * Use `nhost.auth.getUser()` to get the signed-in user.
   *
   * @example
   * ```ts
   * const user = nhost.auth.getUser();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-user
   */
  getUser() {
    return this._client.interpreter?.getSnapshot()?.context?.user || null
  }

  /**
   * Make sure the state machine is set, and wait for it to be ready
   * @returns
   */
  private waitUntilReady(): Promise<AuthInterpreter> {
    const TIMEOUT_IN_SECONS = 15
    const interpreter = this._client.interpreter
    if (!interpreter) {
      throw Error('Auth interpreter not set')
    }
    if (!interpreter.getSnapshot().hasTag('loading')) {
      return Promise.resolve(interpreter)
    }
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> = setTimeout(
        () => reject(`The state machine is not yet ready after ${TIMEOUT_IN_SECONS} seconds.`),
        TIMEOUT_IN_SECONS * 1_000
      )
      interpreter.onTransition((state) => {
        if (!state.hasTag('loading')) {
          clearTimeout(timer)
          return resolve(interpreter)
        }
      })
    })
  }

  private isReady() {
    return !this._client.interpreter?.getSnapshot()?.hasTag('loading')
  }

  get client() {
    return this._client
  }
}
