import jwt_decode from 'jwt-decode'
import { interpret } from 'xstate'

import {
  AuthClient,
  AuthInterpreter,
  changeEmailPromise,
  changePasswordPromise,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  EMAIL_NEEDS_VERIFICATION,
  encodeQueryParameters,
  ErrorPayload,
  INVALID_REFRESH_TOKEN,
  JWTClaims,
  JWTHasuraClaims,
  NO_REFRESH_TOKEN,
  resetPasswordPromise,
  rewriteRedirectTo,
  signInAnonymousPromise,
  signInEmailPasswordlessPromise,
  signInEmailPasswordPromise,
  signOutPromise,
  signUpEmailPasswordPromise,
  TOKEN_REFRESHER_RUNNING_ERROR,
  USER_ALREADY_SIGNED_IN,
  USER_NOT_ANONYMOUS
} from '@nhost/core'

import { getAuthenticationResult, getSession, isBrowser } from './utils/helpers'
import {
  ApiChangeEmailResponse,
  ApiChangePasswordResponse,
  ApiDeanonymizeResponse,
  ApiResetPasswordResponse,
  ApiSendVerificationEmailResponse,
  ApiSignOutResponse,
  AuthChangedFunction,
  ChangeEmailParams,
  ChangePasswordParams,
  DeanonymizeParams,
  NhostAuthConstructorParams,
  OnTokenChangedFunction,
  ResetPasswordParams,
  SendVerificationEmailParams,
  Session,
  SignInParams,
  SignInResponse,
  SignUpParams,
  SignUpResponse
} from './utils/types'

/**
 * @alias Auth
 */
export class HasuraAuthClient {
  private _client: AuthClient

  constructor({
    url,
    autoRefreshToken = true,
    autoSignIn = true,
    autoLogin,
    clientStorage,
    clientStorageType,
    clientStorageGetter,
    clientStorageSetter,
    refreshIntervalTime,
    start = true
  }: NhostAuthConstructorParams) {
    this._client = new AuthClient({
      backendUrl: url,
      clientUrl: (typeof window !== 'undefined' && window.location?.origin) || '',
      autoRefreshToken,
      autoSignIn: typeof autoLogin === 'boolean' ? autoLogin : autoSignIn,
      start,
      clientStorage,
      clientStorageType,
      clientStorageGetter,
      clientStorageSetter,
      refreshIntervalTime
    })
  }

  /**
   * Use `signUp` to sign up users using email an password.
   *
   * If you want to sign up a user using magic link or a social provider, use
   * the `signIn` function instead.
   *
   * @example
   * ```ts
   * auth.signUp({email, password}); // email password
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-up
   */
  async signUp({ email, password, options }: SignUpParams): Promise<SignUpResponse> {
    const interpreter = await this.waitUntilReady()
    return getAuthenticationResult(
      await signUpEmailPasswordPromise(interpreter, email, password, options)
    )
  }

  /**
   * Use `signIn` to sign in users using email and password, passwordless
   * (email or sms) or an external provider.
   * `signIn` can be used in various ways depending on the parameters.
   *
   * @example
   * ### Sign in with email and password
   * ```ts
   * signIn({ email, password });
   * ```
   *
   * @example
   * ### Sign in with an external provider (e.g: Google or Facebook)
   * ```ts
   * signIn({ provider });
   * ```
   *
   * @example
   * ### Passwordless sign in with email (magic link)
   * ```ts
   * signIn({ email }); // [step 1/2] Passwordless sign in with Email (Magic Link)
   * signIn({ email, otp }); // [step 2/2] Finish passwordless sign in with email (OTP)
   * ```
   *
   * @example
   * ### Passwordless sign in with SMS
   * ```ts
   * signIn({ phoneNumber }); // [step 1/2] Passwordless sign in with SMS
   * signIn({ phoneNumber, otp }); // [step 2/2] Finish passwordless sign in with SMS (OTP)
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-in
   */
  async signIn(params: SignInParams): Promise<SignInResponse> {
    const interpreter = await this.waitUntilReady()

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

    // email password
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

    // passwordless Email (magic link)
    if ('email' in params && !('otp' in params)) {
      const { error } = await signInEmailPasswordlessPromise(interpreter, params.email)
      return {
        session: null,
        mfa: null,
        error
      }
    }

    // passwordless SMS
    if ('phoneNumber' in params && !('otp' in params)) {
      return new Promise((resolve) => {
        const { changed } = interpreter.send('SIGNIN_PASSWORDLESS_SMS', params)
        if (!changed) {
          return resolve({ session: null, mfa: null, error: USER_ALREADY_SIGNED_IN })
        }
        interpreter.onTransition((state) => {
          if (state.matches({ authentication: { signedOut: 'needsSmsOtp' } })) {
            resolve({
              session: null,
              mfa: null,
              error: null
            })
          } else if (state.matches({ authentication: { signedOut: 'failed' } })) {
            resolve({
              session: null,
              mfa: null,
              error: state.context.errors.authentication || null
            })
          }
        })
      })
    }

    // sign in using SMS OTP
    if ('otp' in params) {
      return new Promise((resolve) => {
        const { changed } = interpreter.send('SIGNIN_PASSWORDLESS_SMS_OTP', params)
        if (!changed) {
          return resolve({ session: null, mfa: null, error: USER_ALREADY_SIGNED_IN })
        }
        interpreter.onTransition((state) => {
          if (state.matches({ authentication: 'signedIn' })) {
            resolve({
              session: getSession(state.context),
              mfa: null,
              error: null
            })
          } else if (state.matches({ authentication: { signedOut: 'failed' } })) {
            resolve({
              session: null,
              mfa: null,
              error: state.context.errors.authentication || null
            })
          }
        })
      })
    }
    // * Anonymous sign-in
    const anonymousResult = await signInAnonymousPromise(interpreter)
    return { ...getAuthenticationResult(anonymousResult), mfa: null }
  }

  /**
   * Use `signOut` to sign out a user
   *
   * @example
   * ```ts
   * signOut();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/sign-out
   */
  async signOut(params?: { all?: boolean }): Promise<ApiSignOutResponse> {
    const interpreter = await this.waitUntilReady()
    const { error } = await signOutPromise(interpreter, params?.all)
    return { error }
  }

  /**
   * Use `resetPassword` to reset a user's password.
   *
   * @example
   * ```ts
   * auth.resetPassword({email})
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/reset-password
   */
  async resetPassword({ email, options }: ResetPasswordParams): Promise<ApiResetPasswordResponse> {
    const service = interpret(createResetPasswordMachine(this._client)).start()
    const { error } = await resetPasswordPromise(service, email, options)
    return { error }
  }

  /**
   * Use `changePassword` to change a user's password.
   *
   * @example
   * ```ts
   * auth.changePassword({ newPassword })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/change-password
   */
  async changePassword({ newPassword }: ChangePasswordParams): Promise<ApiChangePasswordResponse> {
    const service = interpret(createChangePasswordMachine(this._client)).start()
    const { error } = await changePasswordPromise(service, newPassword)
    return { error }
  }

  /**
   * Use `sendVerificationEmail` to send a verification email
   * to the specified email.
   *
   * @example
   * ```ts
   * auth.sendVerificationEmail({email})
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/send-verification-email
   */
  async sendVerificationEmail(
    params: SendVerificationEmailParams
  ): Promise<ApiSendVerificationEmailResponse> {
    return new Promise((resolve) => {
      const service = interpret(createSendVerificationEmailMachine(this._client)).start()
      service.onTransition(({ event }) => {
        if (event.type === 'ERROR') {
          return resolve({ error: event.error })
        } else if (event.type === 'SUCCESS') {
          return resolve({ error: null })
        }
      })
      service.send('REQUEST', { email: params.email, options: params.options })
    })
  }

  /**
   * Use `changeEmail` to change a user's email
   *
   * @example
   * ```ts
   * auth.changeEmail({newEmail})
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/change-email
   */
  async changeEmail({ newEmail, options }: ChangeEmailParams): Promise<ApiChangeEmailResponse> {
    const service = interpret(createChangeEmailMachine(this._client)).start()
    const { error } = await changeEmailPromise(service, newEmail, options)
    return { error }
  }

  /**
   * Use `deanonymize` to deanonymize a user
   *
   * @example
   * ```ts
   * auth.deanonymize({signInMethod: 'email-password', email})
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/deanonymize
   */
  async deanonymize(params: DeanonymizeParams): Promise<ApiDeanonymizeResponse> {
    const interpreter = await this.waitUntilReady()
    return new Promise((resolve) => {
      if (!this.isAuthenticated() || !interpreter.state.context.user?.isAnonymous) {
        return { error: USER_NOT_ANONYMOUS }
      }
      const { signInMethod, connection, ...options } = params
      interpreter.send('DEANONYMIZE', {
        signInMethod,
        connection,
        options
      })
      interpreter.onTransition((state) => {
        if (state.matches({ authentication: { signedIn: { deanonymizing: 'success' } } })) {
          resolve({ error: null })
        } else if (state.matches({ authentication: { signedIn: { deanonymizing: 'error' } } })) {
          resolve({ error: state.context.errors.authentication || null })
        }
      })
      interpreter.start()
    })
  }

  /**
   * Use `onTokenChanged` to add a custom function that will trigger whenever
   * the access and refresh token is changed.
   *
   * @example
   * ```ts
   * auth.onTokenChanged(() => console.log('access token changed'));
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/on-token-changed
   */
  onTokenChanged(fn: OnTokenChangedFunction): Function {
    const listen = (interpreter: AuthInterpreter) =>
      interpreter.onTransition(({ event, context }) => {
        if (event.type === 'TOKEN_CHANGED') {
          fn(getSession(context))
        }
      })

    if (this._client.interpreter) {
      const subscription = listen(this._client.interpreter)
      return () => subscription.stop()
    } else {
      this._client.onStart((client) => {
        listen(client.interpreter as AuthInterpreter)
      })
      return () => {
        console.log(
          'onTokenChanged was added before the interpreter started. Cannot unsubscribe listener.'
        )
      }
    }
  }

  /**
   * Use `onAuthStateChanged` to add a custom function that will trigger
   * whenever the state of the user changed. Ex from signed in to signed out or
   * vice versa.
   *
   * @example
   * ```ts
   * auth.onAuthStateChanged((event, session) => {
   *   console.log(`Auth state changed. State is now ${event} with session: ${session}`)
   * });
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/on-auth-state-changed
   */
  onAuthStateChanged(fn: AuthChangedFunction): Function {
    const listen = (interpreter: AuthInterpreter) =>
      interpreter.onTransition(({ event, context }) => {
        if (event.type === 'SIGNED_IN' || event.type === 'SIGNED_OUT') {
          fn(event.type, getSession(context))
        }
      })
    if (this._client.interpreter) {
      const subscription = listen(this._client.interpreter)
      return () => subscription.stop()
    } else {
      this._client.onStart((client) => {
        listen(client.interpreter as AuthInterpreter)
      })
      return () => {
        console.log(
          'onAuthStateChanged was added before the interpreter started. Cannot unsubscribe listener.'
        )
      }
    }
  }

  /**
   * Use `isAuthenticated` to check if the user is authenticated or not.
   *
   * Note that `isAuthenticated` can return `false` before the auth status has
   * been resolved. Use `getAuthenticationStatus` to get both loading and auth status.
   *
   *
   * @example
   * ```ts
   * const isAuthenticated = auth.isAuthenticated();
   *
   * if (isAuthenticated) {
   *   console.log('User is authenticated');
   * }
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/is-authenticated
   */
  isAuthenticated(): boolean {
    return !!this._client.interpreter?.state.matches({ authentication: 'signedIn' })
  }

  /**
   * Use `isAuthenticatedAsync` to wait and check if the user is authenticated or not.
   *
   * @example
   * ```ts
   * const isAuthenticated  = await auth.isAuthenticatedAsync();
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
    return interpreter.state.matches({ authentication: 'signedIn' })
  }

  /**
   * Use `getAuthenticationStatus` to get the authentication status of the user.
   *
   * if `isLoading` is true, the auth request is in transit and the SDK does not
   * yet know if the user will be logged in or not.
   *
   *
   * @example
   * ```ts
   * const { isAuthenticated, isLoading } = auth.getAuthenticationStatus();
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
  } {
    if (!this.isReady()) {
      return { isAuthenticated: false, isLoading: true }
    }
    return { isAuthenticated: this.isAuthenticated(), isLoading: false }
  }

  /**
   * @internal
   * @deprecated Use `getAccessToken()` instead.
   * @docs https://docs.nhost.io/reference/javascript/auth/get-access-token
   */

  getJWTToken(): string | undefined {
    return this.getAccessToken()
  }

  /**
   * Use `getAccessToken` to get the logged in user's access token.
   *
   * @example
   * ```ts
   * const accessToken = auth.getAccessToken();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-access-token
   */
  getAccessToken(): string | undefined {
    return this._client.interpreter?.state.context.accessToken.value ?? undefined
  }

  /**
   * Decode the current decoded access token (JWT), or return `null` if the user is not authenticated (no token)
   * @see {@link https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/| Hasura documentation}
   * @docs https://docs.nhost.io/reference/javascript/auth/get-decoded-access-token
   */
  public getDecodedAccessToken(): JWTClaims | null {
    const jwt = this.getAccessToken()
    if (!jwt) return null
    return jwt_decode<JWTClaims>(jwt)
  }

  /**
   * Decode the Hasura claims from the current access token (JWT) located in the `https://hasura.io/jwt/claims` namespace, or return `null` if the user is not authenticated (no token)
   * @see {@link https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/| Hasura documentation}
   * @docs https://docs.nhost.io/reference/javascript/auth/get-hasura-claims
   */
  public getHasuraClaims(): JWTHasuraClaims | null {
    return this.getDecodedAccessToken()?.['https://hasura.io/jwt/claims'] || null
  }

  /**
   * Get the value of a given Hasura claim in the current access token (JWT). Returns null if the user is not authenticated, or if the claim is not in the token.
   * Return `null` if the user is not authenticated (no token)
   * @param name name of the variable. Automatically adds the `x-hasura-` prefix if it is missing
   * @see {@link https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/| Hasura documentation}
   * @docs https://docs.nhost.io/reference/javascript/auth/get-hasura-claim
   */
  public getHasuraClaim(name: string): string | string[] | null {
    return (
      this.getHasuraClaims()?.[name.startsWith('x-hasura-') ? name : `x-hasura-${name}`] || null
    )
  }

  /**
   *
   * Use `refreshSession()` to refresh the current session or refresh the
   * session with an provided `refreshToken`.
   *
   * @example
   * ```ts
   * refreshToken();
   * refreshToken(refreshToken);
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/refresh-session
   */
  async refreshSession(refreshToken?: string): Promise<{
    session: Session | null
    error: ErrorPayload | null
  }> {
    try {
      const interpreter = await this.waitUntilReady()
      return new Promise((resolve) => {
        const token = refreshToken || interpreter.state.context.refreshToken.value
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
   * Use `getSession()` to get the current session.
   *
   * @example
   * ```ts
   * const session = getSession();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-session
   */
  getSession() {
    return getSession(this._client.interpreter?.state?.context)
  }

  /**
   *
   * Use `getUser()` to get the current user.
   *
   * @example
   * ```ts
   * const user = getUser();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/auth/get-user
   */
  getUser() {
    return this._client.interpreter?.state?.context?.user || null
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
    if (!interpreter.state.hasTag('loading')) {
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
    return !this._client.interpreter?.state?.hasTag('loading')
  }

  get client() {
    return this._client
  }
}
