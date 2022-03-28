import { interpret } from 'xstate'

import {
  AuthClient,
  AuthInterpreter,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  encodeQueryParameters,
  rewriteRedirectTo
} from '@nhost/core'

import { getSession, isBrowser, localStorageGetter, localStorageSetter } from './utils/helpers'
import {
  ApiChangeEmailResponse,
  ApiChangePasswordResponse,
  ApiDeanonymizeResponse,
  ApiError,
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
  SignUpParams,
  SignUpResponse
} from './utils/types'
const USER_ALREADY_SIGNED_IN: ApiError = {
  message: 'User is already signed in',
  status: 100
}

const USER_UNAUTHENTICATED: ApiError = {
  message: 'User is not authenticated',
  status: 101
}

const USER_NOT_ANONYMOUS: ApiError = {
  message: 'User is not anonymous',
  status: 101
}
const EMAIL_NEEDS_VERIFICATION: ApiError = {
  message: 'Email needs verification',
  status: 102
}
export class HasuraAuthClient {
  #client: AuthClient
  private onTokenChangedSubscriptions: Set<AuthInterpreter> = new Set()
  private onAuthStateChangedSubscriptions: Set<AuthInterpreter> = new Set()

  constructor({
    url,
    autoRefreshToken = true,
    autoLogin = true,
    clientStorage,
    clientStorageType = 'web',
    clientStorageGetter,
    clientStorageSetter,
    refreshIntervalTime,
    start = true,
    Client = AuthClient
  }: NhostAuthConstructorParams) {
    this.#client = new Client({
      backendUrl: url,
      autoRefreshToken,
      autoSignIn: autoLogin,
      start,
      clientStorageGetter:
        clientStorageGetter || localStorageGetter(clientStorageType, clientStorage),
      clientStorageSetter:
        clientStorageSetter || localStorageSetter(clientStorageType, clientStorage),
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
   * auth.signIn({email, password}); // email password
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-signup
   */
  async signUp(params: SignUpParams): Promise<SignUpResponse> {
    const interpreter = this.#client.interpreter
    if (!interpreter) {
      throw Error('Auth interpreter not set')
    }

    const { email, password, options } = params

    // * Raise an error if the user is already authenticated
    if (this.isAuthenticated()) {
      return {
        session: null,
        error: USER_ALREADY_SIGNED_IN
      }
    }

    return new Promise((resolve) => {
      interpreter.send({ type: 'SIGNUP_EMAIL_PASSWORD', email, password, options })
      interpreter.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'needsEmailVerification' } }))
          return resolve({ session: null, error: null })
        else if (state.matches({ authentication: { signedOut: 'failed' } })) {
          return resolve({ session: null, error: state.context.errors.registration || null })
        } else if (state.matches({ authentication: 'signedIn' }))
          return resolve({ session: getSession(state.context), error: null })
      })
    })
  }

  /**
   * Use `signIn` to sign in users using email and password, passwordless
   * (email or sms) or an external provider.
   * `signIn` can be used in various ways depending on the parameters.
   *
   * @example
   * signIn({ email, password }); // Sign in with email and password
   * signIn({ provider }); // Sign in with an external provider (ex Google or Facebook)
   * signIn({ email }); // [step 1/2] Passwordless sign in with Email (Magic Link)
   * signIn({ email, otp }); // [step 2/2] Finish passwordless sign in with email (OTP)
   * signIn({ phoneNumber }); // [step 1/2] Passwordless sign in with SMS
   * signIn({ phoneNumber, otp }); // [step 2/2] Finish passwordless sign in with SMS (OTP)
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-signin
   */
  async signIn(params: SignInParams): Promise<{
    session: Session | null
    mfa: {
      ticket: string
    } | null
    error: ApiError | null
    providerUrl?: string
    provider?: string
  }> {
    const interpreter = this.#client.interpreter
    if (!interpreter) throw Error('Auth interpreter not set')

    // * Raise an error if the user is already authenticated
    if (this.isAuthenticated()) {
      return {
        session: null,
        mfa: null,
        error: USER_ALREADY_SIGNED_IN
      }
    }

    if ('provider' in params) {
      const { provider, options } = params
      const providerUrl = encodeQueryParameters(
        `${this.#client.backendUrl}/v1/auth/signin/provider/${provider}`,
        rewriteRedirectTo(this.#client.clientUrl, options)
      )
      if (isBrowser()) {
        window.location.href = providerUrl
      }
      return { providerUrl, provider, session: null, mfa: null, error: null }
    }

    // email password
    if ('email' in params && 'password' in params) {
      return new Promise((resolve) => {
        interpreter.send({ type: 'SIGNIN_PASSWORD', ...params })
        interpreter.onTransition((state) => {
          if (state.matches({ authentication: 'signedIn' }))
            resolve({
              session: getSession(state.context),
              mfa: null,
              error: null
            })
          else if (state.matches({ authentication: { signedOut: 'needsEmailVerification' } }))
            resolve({
              session: null,
              mfa: null,
              error: EMAIL_NEEDS_VERIFICATION
            })
          else if (state.matches({ authentication: { signedOut: 'needsMfa' } }))
            resolve({
              session: null,
              mfa: state.context.mfa,
              error: null
            })
          else if (state.matches({ authentication: { signedOut: 'failed' } }))
            resolve({
              session: null,
              mfa: null,
              error: state.context.errors.authentication || null
            })
        })
      })
    }

    // passwordless Email (magic link)
    if ('email' in params && !('otp' in params)) {
      return new Promise((resolve) => {
        interpreter.onTransition((state) => {
          if (state.matches({ authentication: { signedOut: 'needsEmailVerification' } }))
            resolve({
              session: null,
              mfa: null,
              error: null
            })
          else if (state.matches({ authentication: { signedOut: 'failed' } }))
            resolve({
              session: null,
              mfa: null,
              error: state.context.errors.authentication || null
            })
        })

        interpreter.send({ type: 'SIGNIN_PASSWORDLESS_EMAIL', ...params })
      })
    }

    // passwordless SMS
    if ('phoneNumber' in params && !('otp' in params)) {
      return new Promise((resolve) => {
        interpreter.onTransition((state) => {
          if (state.matches({ authentication: { signedOut: 'needsSmsOtp' } }))
            resolve({
              session: null,
              mfa: null,
              error: null
            })
          else if (state.matches({ authentication: { signedOut: 'failed' } }))
            resolve({
              session: null,
              mfa: null,
              error: state.context.errors.authentication || null
            })
        })
        interpreter.send({ type: 'SIGNIN_PASSWORDLESS_SMS', ...params })
      })
    }

    // sign in using SMS OTP
    if ('otp' in params) {
      return new Promise((resolve) => {
        interpreter.onTransition((state) => {
          if (state.matches({ authentication: 'signedIn' }))
            resolve({
              session: getSession(state.context),
              mfa: null,
              error: null
            })
          else if (state.matches({ authentication: { signedOut: 'failed' } }))
            resolve({
              session: null,
              mfa: null,
              error: state.context.errors.authentication || null
            })
        })
        interpreter.send({ type: 'SIGNIN_PASSWORDLESS_SMS_OTP', ...params })
      })
    }
    // TODO anonymous sign-in
    return {
      session: null,
      mfa: null,
      error: { message: 'Incorrect parameters', status: 500 }
    }
  }

  /**
   * Use `signOut` to sign out a user
   *
   * @example
   * signOut();
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-signout
   */
  async signOut(params?: { all?: boolean }): Promise<ApiSignOutResponse> {
    const interpreter = this.#client.interpreter
    if (!interpreter) throw Error('Auth interpreter not set')
    if (!this.isAuthenticated()) return { error: USER_UNAUTHENTICATED }
    return new Promise((resolve) => {
      interpreter.send({ type: 'SIGNOUT', all: params?.all })
      interpreter.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'success' } })) resolve({ error: null })
        else if (state.matches({ authentication: { signedOut: 'failed' } }))
          resolve({ error: state.context.errors.signout || null })
      })
    })
  }

  /**
   * Use `resetPassword` to reset a user's password.
   *
   * @example
   * auth.resetPassword({email})
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-resetpassword
   */
  async resetPassword({ email, options }: ResetPasswordParams): Promise<ApiResetPasswordResponse> {
    return new Promise((resolve) => {
      const service = interpret(createResetPasswordMachine(this.#client))
      service.onTransition(({ event }) => {
        if (event.type === 'ERROR') return resolve({ error: event.error })
        else if (event.type === 'SUCCESS') return resolve({ error: null })
      })
      service.start()
      service.send({ type: 'REQUEST', email, options })
    })
  }

  /**
   * Use `changePassword` to change a user's password.
   *
   * @example
   * auth.changePassword({ newPassword })
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-changepassword
   */
  async changePassword(params: ChangePasswordParams): Promise<ApiChangePasswordResponse> {
    return new Promise((resolve) => {
      const service = interpret(createChangePasswordMachine(this.#client))
      service.onTransition(({ event }) => {
        if (event.type === 'ERROR') return resolve({ error: event.error })
        else if (event.type === 'SUCCESS') return resolve({ error: null })
      })
      service.start()
      service.send({ type: 'REQUEST', password: params.newPassword })
    })
  }

  /**
   * Use `sendVerificationEmail` to send a verification email
   * to the specified email.
   *
   * @example
   * auth.sendVerificationEmail({email})
   *
   * @docs https://docs.nhost.io/TODO
   */
  async sendVerificationEmail(
    params: SendVerificationEmailParams
  ): Promise<ApiSendVerificationEmailResponse> {
    return new Promise((resolve) => {
      const service = interpret(createSendVerificationEmailMachine(this.#client))
      service.onTransition(({ event }) => {
        if (event.type === 'ERROR') return resolve({ error: event.error })
        else if (event.type === 'SUCCESS') return resolve({ error: null })
      })
      service.start()
      service.send({ type: 'REQUEST', email: params.email, options: params.options })
    })
  }

  /**
   * Use `changeEmail` to change a user's email
   *
   * @example
   * auth.changeEmail({newEmail})
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-changeemail
   */
  async changeEmail({ newEmail, options }: ChangeEmailParams): Promise<ApiChangeEmailResponse> {
    return new Promise((resolve) => {
      const service = interpret(createChangeEmailMachine(this.#client))
      service.onTransition(({ event }) => {
        if (event.type === 'ERROR') return resolve({ error: event.error })
        else if (event.type === 'SUCCESS') return resolve({ error: null })
      })
      service.start()
      service.send({ type: 'REQUEST', email: newEmail, options })
    })
  }

  /**
   * Use `deanonymize` to deanonymize a user
   *
   * @example
   * auth.deanonymize({signInMethod: 'email-password', email})
   *
   * @docs https://docs.nhost.io/TODO
   */
  async deanonymize(params: DeanonymizeParams): Promise<ApiDeanonymizeResponse> {
    return new Promise((resolve) => {
      const interpreter = this.#client.interpreter
      if (!interpreter) throw Error('Auth interpreter not set')
      if (!this.isAuthenticated() || !interpreter.state.context.user?.isAnonymous)
        return { error: USER_NOT_ANONYMOUS }
      interpreter.onTransition((state) => {
        if (state.matches({ authentication: { signedIn: { deanonymizing: 'success' } } }))
          resolve({ error: null })
        else if (state.matches({ authentication: { signedIn: { deanonymizing: 'error' } } }))
          resolve({ error: state.context.errors.authentication || null })
      })
      interpreter.start()
      const { signInMethod, connection, ...options } = params
      interpreter.send({
        type: 'DEANONYMIZE',
        signInMethod,
        connection,
        options
      })
    })
  }

  /**
   * Use `onTokenChanged` to add a custom function that will trigger whenever
   * the access and refresh token is changed.
   *
   * @example
   * auth.onTokenChanged(() => console.log('access token changed'););
   *
   * @docs https://docs.nhost.io/TODO
   */
  onTokenChanged(fn: OnTokenChangedFunction): Function {
    if (this.#client.interpreter)
      this.onTokenChangedSubscriptions.add(
        this.#client.interpreter?.onTransition(({ event, context }) => {
          if (event.type === 'TOKEN_CHANGED') fn(getSession(context))
        })
      )
    else {
      console.log('onTokenChanged: no interpreter is set yet', fn)
    }
    return () => {
      this.onTokenChangedSubscriptions.forEach((subscription) => subscription.stop())
    }
  }

  /**
   * Use `onAuthStateChanged` to add a custom function that will trigger
   * whenever the state of the user changed. Ex from signed in to signed out or
   * vice versa.
   *
   * @example
   * auth.onAuthStateChanged((event, session) => {
   *   console.log(`auth state changed. State is not ${event} with session: ${session}`)
   * });
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-onauthstatechangedevent,-session
   */
  onAuthStateChanged(fn: AuthChangedFunction): Function {
    if (this.#client.interpreter)
      this.onAuthStateChangedSubscriptions.add(
        this.#client.interpreter?.onTransition(({ event, context }) => {
          if (event.type === 'SIGNED_IN') fn('SIGNED_IN', getSession(context))
          else if (event.type === 'SIGNED_OUT') fn('SIGNED_OUT', getSession(context))
        })
      )
    else {
      console.log('onAuthStateChanged: no interpreter is set yet', fn)
    }
    return () => {
      this.onAuthStateChangedSubscriptions.forEach((subscription) => subscription.stop())
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
   *
   * const  = auth.isAuthenticated();
   *
   * if (authenticated) {
   *   console.log('User is authenticated');
   * }
   *
   * @docs https://docs.nhost.io/TODO
   */
  isAuthenticated(): boolean {
    return !!this.#client.interpreter?.state.matches({ authentication: 'signedIn' })
  }

  /**
   * Use `isAuthenticatedAsync` to wait and check if the user is authenticated or not.
   *
   * @example
   *
   * const isAuthenticated  = awiat auth.isAuthenticatedAsync();
   *
   * if (isAuthenticated) {
   *   console.log('User is authenticated');
   * }
   *
   * @docs https://docs.nhost.io/TODO
   */
  async isAuthenticatedAsync(): Promise<boolean> {
    return new Promise((resolve) => {
      // if init auth loading is already completed, we can return the value of `isAuthenticated`.
      if (this.isReady()) resolve(this.isAuthenticated())
      const interpreter = this.#client.interpreter
      if (!interpreter) resolve(false)
      interpreter?.onTransition((state) => {
        if (state.hasTag('ready')) resolve(state.matches({ authentication: 'signedIn' }))
      })
    })
  }

  /**
   * Use `getAuthenticationStatus` to get the authentication status of the user.
   *
   * if `isLoading` is true, the auth request is in transit and the SDK does not
   * yet know if the user will be logged in or not.
   *
   *
   * @example
   *
   * const { isAuthenticated, isLoading } = auth.getAuthenticationStatus();
   *
   * if (isLoading) {
   *   console.log('Loading...')
   * }
   *
   * if (isAuthenticated) {
   *   console.log('User is authenticated');
   * }
   *
   * @docs https://docs.nhost.io/TODO
   */
  getAuthenticationStatus(): {
    isAuthenticated: boolean
    isLoading: boolean
  } {
    if (!this.isReady()) return { isAuthenticated: false, isLoading: true }
    return { isAuthenticated: this.isAuthenticated(), isLoading: false }
  }

  /**
   * @deprecated Use `getAccessToken()` instead.
   */

  getJWTToken(): string | undefined {
    return this.getAccessToken()
  }

  /**
   *
   * Use `getAccessToken` to get the logged in user's access token.
   *
   * @example
   *
   * const accessToken = auth.getAccessToken();
   *
   * @docs https://docs.nhost.io/TODO
   */
  getAccessToken(): string | undefined {
    return this.#client.interpreter?.state.context.accessToken.value ?? undefined
  }

  /**
   *
   * Use `refreshSession()` to refresh the current session or refresh the
   * session with an provided `refreshToken`.
   *
   * @example
   *
   * refreshToken();
   * refreshToken(refreshToken);
   *
   * @docs https://docs.nhost.io/TODO
   */
  async refreshSession(refreshToken?: string): Promise<void> {
    return new Promise((resolve) => {
      const interpreter = this.#client.interpreter
      if (!interpreter || !interpreter.state.matches({ token: 'idle' })) return resolve()
      const token = refreshToken || interpreter.state.context.refreshToken.value
      if (!token) return resolve()
      interpreter?.onTransition((state) => {
        if (state.matches({ token: { idle: 'error' } })) resolve()
        else if (state.event.type === 'TOKEN_CHANGED') resolve()
      })
      interpreter.send({
        type: 'TRY_TOKEN',
        token
      })
    })
  }

  /**
   *
   * Use `getSession()` to get the current session.
   *
   * @example
   *
   * const session = getSession();
   *
   * @docs https://docs.nhost.io/TODO
   */
  getSession() {
    return getSession(this.#client.interpreter?.state?.context)
  }

  /**
   *
   * Use `getUser()` to get the current user.
   *
   * @example
   *
   * const user = getUser();
   *
   * @docs https://docs.nhost.io/reference/sdk/authentication#nhost-auth-getuser
   */
  getUser() {
    return this.#client.interpreter?.state?.context?.user || null
  }

  private isReady() {
    return !!this.#client.interpreter?.state?.hasTag('ready')
  }

  get client() {
    return this.#client
  }
}
