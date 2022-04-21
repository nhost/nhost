import { interpret } from 'xstate'

import { MIN_TOKEN_REFRESH_INTERVAL } from './constants'
import { AuthMachine, AuthMachineOptions, createAuthMachine } from './machines'
import { defaultClientStorageGetter, defaultClientStorageSetter } from './storage'
import type { AuthInterpreter } from './types'

export type NhostClientOptions = AuthMachineOptions & { start?: boolean }

export class AuthClient {
  readonly backendUrl: string
  readonly clientUrl: string
  readonly machine: AuthMachine
  private _interpreter?: AuthInterpreter
  private _channel?: BroadcastChannel
  private _subscriptions: Set<(client: AuthClient) => void> = new Set()

  constructor({
    backendUrl,
    clientUrl = (typeof window !== 'undefined' && window.location?.origin) || '',
    clientStorageGetter = defaultClientStorageGetter,
    clientStorageSetter = defaultClientStorageSetter,
    refreshIntervalTime = MIN_TOKEN_REFRESH_INTERVAL,
    autoSignIn = true,
    autoRefreshToken = true,
    start = true
  }: NhostClientOptions) {
    this.backendUrl = backendUrl
    this.clientUrl = clientUrl

    this.machine = createAuthMachine({
      backendUrl,
      clientUrl,
      refreshIntervalTime,
      clientStorageGetter,
      clientStorageSetter,
      autoSignIn,
      autoRefreshToken
    })

    if (start) {
      this.interpreter = interpret(this.machine)
      this.interpreter.start()
    }

    if (typeof window !== 'undefined' && autoSignIn) {
      try {
        this._channel = new BroadcastChannel('nhost')
        this._channel.addEventListener('message', (token) => {
          const existingToken = this.interpreter?.state.context.refreshToken
          if (this.interpreter && token.data !== existingToken) {
            this.interpreter.send({ type: 'TRY_TOKEN', token: token.data })
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
