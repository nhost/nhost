import { interpret } from 'xstate'
import {
  AuthContext,
  AuthInterpreter,
  AuthMachine,
  AuthMachineOptions,
  createAuthMachine
} from './machines'
import { NhostSession } from './types'
import { isBrowser } from './utils'

export type NhostClientOptions = AuthMachineOptions & {
  /** @internal create and start xstate interpreter on creation. With React, it is started inside the Nhost provider */
  start?: boolean
}

/**
 * @internal
 * This is a private API.
 */
export class AuthClient {
  readonly backendUrl: string
  readonly clientUrl: string
  private _machine: AuthMachine
  private _interpreter?: AuthInterpreter
  private _started = false
  private _channel?: BroadcastChannel
  private _subscriptionsQueue: Set<(client: AuthClient) => void> = new Set()
  private _subscriptions: Set<() => void> = new Set()

  constructor({
    clientStorageType = 'web',
    autoSignIn = true,
    autoRefreshToken = true,
    start = true,
    backendUrl,
    clientUrl,
    broadcastKey,
    devTools,
    ...defaultOptions
  }: NhostClientOptions) {
    this.backendUrl = backendUrl
    this.clientUrl = clientUrl

    this._machine = createAuthMachine({
      ...defaultOptions,
      backendUrl,
      clientUrl,
      broadcastKey,
      clientStorageType,
      autoSignIn,
      autoRefreshToken
    })

    if (start) {
      this.start({ devTools })
    }

    if (typeof window !== 'undefined' && broadcastKey) {
      try {
        this._channel = new BroadcastChannel(broadcastKey)

        if (autoSignIn) {
          this._channel?.addEventListener('message', (event) => {
            const { type, payload } = event.data

            if (type === 'broadcast_session') {
              const context = this.interpreter?.getSnapshot().context
              const existingToken = context?.refreshToken.value

              // console.debug('[AUTH] Received broadcast session:', payload.token?.substring(0,6), existingToken?.substring(0,6))

              // Only update if this is a new token or if we don't have a token yet
              if (this.interpreter && payload.token && payload.token !== existingToken) {
                // console.debug('[AUTH] Received broadcast with new token:', payload.token ? payload.token.substring(0, 6) + '...' : 'null',
                //   'Previous token:', existingToken ? existingToken.substring(0, 6) + '...' : 'null')
                // Send a SESSION_UPDATE event with the full session data instead of making a token call
                this.interpreter.send('SESSION_UPDATE', {
                  data: {
                    session: {
                      user: payload.user,
                      accessToken: payload.accessToken,
                      refreshToken: payload.token,
                      accessTokenExpiresIn: payload.expiresInSeconds
                    }
                  }
                })
              }
            }
          })
        }

        this._channel.addEventListener('message', (event) => {
          const { type } = event.data

          if (type === 'signout') {
            if (this.interpreter) {
              this.interpreter.send('SIGNOUT')
            }
          }
        })
      } catch (error) {
        // * BroadcastChannel is not available e.g. react-native
      }
    }
  }

  start({
    devTools = false,
    initialSession,
    interpreter
  }: { interpreter?: AuthInterpreter; initialSession?: NhostSession; devTools?: boolean } = {}) {
    // Create a deep copy of the machine context to ensure that nested objects (such as accessToken and refreshToken) are not mutated in the original context.
    const context: AuthContext = {
      ...this.machine.context,
      accessToken: {
        ...this.machine.context.accessToken
      },
      refreshToken: {
        ...this.machine.context.refreshToken
      }
    }

    if (initialSession) {
      context.user = initialSession.user
      context.refreshToken.value = initialSession.refreshToken ?? null
      context.accessToken.value = initialSession.accessToken ?? null
      context.accessToken.expiresAt = new Date(
        Date.now() + initialSession.accessTokenExpiresIn * 1_000
      )
    }
    const machineWithInitialContext = this.machine.withContext(context)

    if (!this._interpreter) {
      this._interpreter = interpreter || interpret(machineWithInitialContext, { devTools })
    }

    // * Start the interpreter if not started already. Always restart the interpreter when on the server side
    if (!this._started || typeof window === 'undefined') {
      if (this._interpreter.initialized) {
        this._interpreter.stop()
        this._subscriptions.forEach((fn) => fn())
      }
      this._interpreter.start(machineWithInitialContext.initialState)
      this._subscriptionsQueue.forEach((fn) => fn(this))
    }

    this._started = true
  }

  public get machine() {
    return this._machine
  }

  get interpreter(): AuthInterpreter | undefined {
    return this._interpreter
  }

  get started(): boolean {
    return this._started
  }

  subscribe(fn: (client: AuthClient) => () => void): () => void {
    if (this.started) {
      // * The interpreter is already available: we can add the listener straight ahead
      const subscription = fn(this)
      this._subscriptions.add(subscription)
      return subscription
    } else {
      // * The interpreter is not yet available: we add the listener to a queue that will be started when setting the interpreter
      // * Note: in React, the Xstate interpreter does not start from the global state, but from the root component
      this._subscriptionsQueue.add(fn)
      return () => {
        console.log(
          'onTokenChanged was added before the interpreter started. Cannot unsubscribe listener.'
        )
      }
    }
  }
}

/** @deprecated Not in use anymore. Use `clientStorageType: 'cookie'` instead */
export class AuthCookieClient extends AuthClient {
  constructor({
    ...options
  }: Omit<
    NhostClientOptions,
    'clientStorageGetter' | 'clientStorageSetter' | 'clientStorage' | 'clientStorageType'
  >) {
    super({
      ...options,
      autoSignIn: isBrowser() && options.autoSignIn,
      autoRefreshToken: isBrowser() && options.autoRefreshToken,
      clientStorageType: 'cookie'
    })
  }
}

/** @deprecated Alias for {@link AuthCookieClient} */
export const AuthClientSSR = AuthCookieClient
