import { interpret } from 'xstate'

import { AuthMachine, AuthMachineOptions, createAuthMachine } from './machines'
import type { AuthInterpreter } from './types'

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
  readonly machine: AuthMachine
  private _interpreter?: AuthInterpreter
  private _channel?: BroadcastChannel
  private _subscriptions: Set<(client: AuthClient) => void> = new Set()

  constructor({
    clientStorageType = 'web',
    autoSignIn = true,
    autoRefreshToken = true,
    start = true,
    backendUrl,
    clientUrl,
    devTools,
    ...defaultOptions
  }: NhostClientOptions) {
    this.backendUrl = backendUrl
    this.clientUrl = clientUrl

    this.machine = createAuthMachine({
      ...defaultOptions,
      backendUrl,
      clientUrl,
      clientStorageType,
      autoSignIn,
      autoRefreshToken
    })

    if (start) {
      this.interpreter = interpret(this.machine, { devTools })
      this.interpreter.start()
    }

    if (typeof window !== 'undefined' && autoSignIn) {
      try {
        // TODO listen to sign out
        // TODO the same refresh token is used and refreshed by all tabs
        // * Ideally, a single tab should autorefresh and share the new jwt
        this._channel = new BroadcastChannel('nhost')
        this._channel.addEventListener('message', (token) => {
          const existingToken = this.interpreter?.getSnapshot().context.refreshToken.value
          if (this.interpreter && token.data !== existingToken) {
            this.interpreter.send('TRY_TOKEN', { token: token.data })
          }
        })
      } catch (error) {
        // * BroadcastChannel is not available e.g. react-native
      }
    }
  }

  get interpreter(): AuthInterpreter | undefined {
    return this._interpreter
  }
  set interpreter(interpreter: AuthInterpreter | undefined) {
    this._interpreter = interpreter
    if (interpreter) {
      this._subscriptions.forEach((fn) => fn(this))
    }
  }

  onStart(fn: (client: AuthClient) => void) {
    if (this.interpreter) {
      // * The interpreter is already available: we can add the listener straight ahead
      fn(this)
    } else {
      // * The interpreter is not yet available: we add the listener to a queue that will be started when setting the interpreter
      // * Note: in React, the Xstate interpreter does not start from the global state, but from the root component
      this._subscriptions.add(fn)
    }
  }
}
