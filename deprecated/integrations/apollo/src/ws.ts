// * See https://github.com/enisdenjo/graphql-ws#graceful-restart
import { Client, ClientOptions, createClient } from 'graphql-ws'

export interface RestartableClient extends Client {
  restart(): void
  isOpen(): boolean
}

export function createRestartableClient(options: ClientOptions): RestartableClient {
  let restartRequested = false
  let restart = () => {
    restartRequested = true
  }

  let connectionOpen = false
  let socket: WebSocket
  let timedOut: NodeJS.Timeout

  const client = createClient({
    ...options,
    on: {
      ...options.on,
      error: (error) => {
        console.error(error)
        options.on?.error?.(error)

        restart()
      },
      ping: (received) => {
        if (!received /* sent */) {
          timedOut = setTimeout(() => {
            // a close event `4499: Terminated` is issued to the current WebSocket and an
            // artificial `{ code: 4499, reason: 'Terminated', wasClean: false }` close-event-like
            // object is immediately emitted without waiting for the one coming from `WebSocket.onclose`
            //
            // calling terminate is not considered fatal and a connection retry will occur as expected
            //
            // see: https://github.com/enisdenjo/graphql-ws/discussions/290
            client.terminate()
            restart()
          }, 5_000)
        }
      },
      pong: (received) => {
        if (received) {
          clearTimeout(timedOut)
        }
      },
      opened: (originalSocket) => {
        socket = originalSocket as WebSocket
        options.on?.opened?.(socket)
        connectionOpen = true

        restart = () => {
          if (socket.readyState === WebSocket.OPEN) {
            // if the socket is still open for the restart, do the restart
            socket.close(4205, 'Client Restart')
          } else {
            // otherwise the socket might've closed, indicate that you want
            // a restart on the next opened event
            restartRequested = true
          }
        }

        // just in case you were eager to restart
        if (restartRequested) {
          restartRequested = false
          restart()
        }
      },
      closed: (event) => {
        options?.on?.closed?.(event)
        connectionOpen = false
      }
    }
  })

  return {
    ...client,
    restart: () => restart(),
    isOpen: () => connectionOpen
  }
}
