import { interpret, InterpreterFrom } from 'xstate'

import {
  createChangeEmailMachine,
  createChangePasswordMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  Nhost,
  NhostMachine
} from '@nhost/core'

import { isBrowser } from './utils/helpers'
import {
  ApiChangeEmailResponse,
  ApiChangePasswordResponse,
  ApiDeanonymizeResponse,
  ApiError,
  ApiResetPasswordResponse,
  ApiSendVerificationEmailResponse,
  ApiSignInResponse,
  ApiSignOutResponse,
  AuthChangedFunction,
  ChangeEmailParams,
  ChangePasswordParams,
  ClientStorage,
  ClientStorageType,
  DeanonymizeParams,
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
const EMAIL_NEEDS_VERIFICATION: ApiError = {
  message: 'Email needs verification',
  status: 102
}
export class HasuraAuthClient {
  private client: Nhost
  private onTokenChangedSubscriptions: Set<InterpreterFrom<NhostMachine>> = new Set()

  constructor({
    url,
    autoRefreshToken = true,
    autoLogin = true,
    refreshIntervalTime,
    clientStorage,
    clientStorageType = 'web',
    start = true
  }: {
    url: string
    autoRefreshToken?: boolean
    autoLogin?: boolean
    refreshIntervalTime?: number
    clientStorage?: ClientStorage
    clientStorageType?: ClientStorageType
    start?: boolean
  }) {
    const backendUrl = url.endsWith('/v1/auth') ? url.replace('/v1/auth', '') : url

    // TODO refreshIntervalTime
    // TODO custom clientStorage and clientStorageType
    // ? no warning when using with Nodejs?
    this.client = new Nhost({
      backendUrl,
      autoRefreshToken,
      autoSignIn: autoLogin,
      start,
      storageGetter: () => {
        return null
      },
      storageSetter: () => { }
    })
    // this.client.interpreter?.onTransition((state) => {
    //   console.log('Transition:', state.event)
    // })
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
   * @docs https://docs.nhost.io/TODO
   */
  async signUp(params: SignUpParams): Promise<SignUpResponse> {
    if (!this.client.interpreter) throw Error('interpreter not set ') // TODO a bit brutal.
    const { email, password, options } = params

    // * Raise an error if the user is already authenticated
    if (this.isAuthenticated()) {
      return {
        session: null,
        error: USER_ALREADY_SIGNED_IN
      }
    }

    return new Promise((resolve) => {
      this.client.interpreter?.send({ type: 'SIGNUP_EMAIL_PASSWORD', email, password, options })
      this.client.interpreter?.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'needsVerification' } }))
          return resolve({ session: null, error: null })
        else if (state.matches({ authentication: { signedOut: 'failed' } })) {
          return resolve({ session: null, error: state.context.errors.registration || null })
        } else if (state.matches({ authentication: 'signedIn' }))
          return resolve({ session: this.getSession(), error: null })
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
   * @docs https://docs.nhost.io/TODO
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
    // * Raise an error if the user is already authenticated
    if (this.isAuthenticated()) {
      return {
        session: null,
        mfa: null,
        error: USER_ALREADY_SIGNED_IN
      }
    }

    if ('provider' in params) {
      const { provider } = params
      const providerUrl = `${this.client.backendUrl}/v1/auth/signin/provider/${provider}`

      if (isBrowser()) {
        window.location.href = providerUrl
      }
      return { providerUrl, provider, session: null, mfa: null, error: null }
    }

    // email password
    if ('email' in params && 'password' in params) {
      return new Promise((resolve) => {
        this.client.interpreter?.send({ type: 'SIGNIN_PASSWORD', ...params })
        this.client.interpreter?.onTransition((state) => {
          if (state.matches({ authentication: 'signedIn' }))
            resolve({
              session: this.getSession(),
              mfa: null, // TODO MFA
              error: null
            })
          else if (state.matches({ authentication: { signedOut: 'needsVerification' } }))
            resolve({
              session: null,
              mfa: null,
              error: EMAIL_NEEDS_VERIFICATION
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
        this.client.interpreter?.onTransition((state) => {
          if (state.matches({ authentication: { signedOut: 'needsVerification' } }))
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

        this.client.interpreter?.send({ type: 'SIGNIN_PASSWORDLESS_EMAIL', ...params })
      })
    }

    // passwordless SMS
    if ('phoneNumber' in params && !('otp' in params)) {
      // TODO implement phoneNumber
      console.warn('TODO implement OTP')
      return { session: null, error: null } as any
      /*
            const { error } = await this.api.signInPasswordlessSms(params)
      
            if (error) {
              return { session: null, mfa: null, error }
            }
      
            return { session: null, mfa: null, error: null }
            */
    }

    // sign in using OTP
    if ('otp' in params) {
      // TODO implement OTP
      console.warn('TODO implement OTP')
      return { session: null, error: null } as any
      /*
      const { data, error } = await this.api.signInPasswordlessSmsOtp(params)

      if (error) {
        return { session: null, mfa: null, error }
      }
      if (!data) {
        return {
          session: null,
          mfa: null,
          error: { message: 'Incorrect data', status: 500 }
        }
      }
      const { mfa } = data
      return { session: this.getSession(), mfa, error: null }
      */
    }

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
   * @docs https://docs.nhost.io/TODO
   */
  async signOut(params?: { all?: boolean }): Promise<ApiSignOutResponse> {
    if (!this.client.interpreter) throw Error('interpreter not set ') // TODO a bit brutal.
    if (!this.isAuthenticated()) {
      // console.log('not authenticated')
      return { error: USER_UNAUTHENTICATED }
    }
    return new Promise((resolve) => {
      this.client.interpreter?.send({ type: 'SIGNOUT', all: params?.all })
      this.client.interpreter?.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'success' } })) resolve({ error: null })
        // TODO possible errors
        else {
          // console.log('SIGNOUT weird stuff', state.value)
        }
      })
    })
  }

  /**
   * Use `verifyEmail` to verify a user's email using a ticket.
   *
   * @example
   * auth.verifyEmail({email, tricket})
   *
   * @docs https://docs.nhost.io/TODO
   */
  async verifyEmail(params: { email: string; ticket: string }): Promise<ApiSignInResponse> {
    // TODO implement
    // return await this.api.verifyEmail(params)
    console.warn('TODO implement verifyEmail')
    return { data: null, error: null } as any
  }

  /**
   * Use `resetPassword` to reset a user's password.
   *
   * @example
   * auth.resetPassword({email})
   *
   * @docs https://docs.nhost.io/TODO
   */
  async resetPassword({ email, options }: ResetPasswordParams): Promise<ApiResetPasswordResponse> {
    return new Promise((resolve) => {
      const service = interpret(createResetPasswordMachine(this.client))
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
   * @docs https://docs.nhost.io/TODO
   */
  async changePassword(params: ChangePasswordParams): Promise<ApiChangePasswordResponse> {
    return new Promise((resolve) => {
      const service = interpret(createChangePasswordMachine(this.client))
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
      const service = interpret(createSendVerificationEmailMachine(this.client))
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
   * @docs https://docs.nhost.io/TODO
   */
  async changeEmail({ newEmail, options }: ChangeEmailParams): Promise<ApiChangeEmailResponse> {
    return new Promise((resolve) => {
      const service = interpret(createChangeEmailMachine(this.client))
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
    // TODO implement
    /*
    const { error } = await this.api.deanonymize(params)
    return { error }
    */
    return { error: null }
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
    if (this.client.interpreter)
      this.onTokenChangedSubscriptions.add(
        this.client.interpreter?.onTransition((state) => {
          // TODO ONLY WHEN TOKEN CHANGED
          fn(this.getSession())
        })
      )

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
   * auth.onAuthStateChanged(({event, session}) => {
   *   console.log(`auth state changed. State is not ${event} with session: ${session}`)
   * });
   *
   * @docs https://docs.nhost.io/TODO
   */
  onAuthStateChanged(fn: AuthChangedFunction): Function {
    if (this.client.interpreter)
      this.onTokenChangedSubscriptions.add(
        this.client.interpreter?.onTransition((state) => {
          // TODO ONLY WHEN AUTH STATUS CHANGED
          fn('SIGNED_IN', this.getSession())
          fn('SIGNED_OUT', this.getSession())
        })
      )

    return () => {
      this.onTokenChangedSubscriptions.forEach((subscription) => subscription.stop())
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
    return !!this.client.interpreter?.state.matches({ authentication: 'signedIn' })
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
      const interpreter = this.client.interpreter
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
    return this.client.interpreter?.state.context.accessToken.value ?? undefined
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
    // TODO
    // TODO 'force' refresh when refreshToken is undefined
    // TODO wait for the result
    /* 
    const refreshTokenToUse = refreshToken || (await this._getItem(NHOST_REFRESH_TOKEN))

    if (!refreshTokenToUse) {
      console.warn('no refresh token found. No way of refreshing session')
    }

    return this._refreshTokens(refreshTokenToUse)
    */
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
  getSession(): Session | null {
    const context = this.client.interpreter?.state.context
    if (!context || !context.accessToken.value || !context.refreshToken.value) return null
    return {
      accessToken: context.accessToken.value,
      accessTokenExpiresIn: (context.accessToken.expiresAt.getTime() - Date.now()) / 1000,
      refreshToken: context.refreshToken.value,
      user: context.user
    }
  }

  /**
   *
   * Use `getUser()` to get the current user.
   *
   * @example
   *
   * const user = getUser();
   *
   * @docs https://docs.nhost.io/TODO
   */
  getUser() {
    return this.client.interpreter?.state.context.user || null
  }

  private isReady() {
    return !!this.client.interpreter?.state.hasTag('ready')
  }
}
