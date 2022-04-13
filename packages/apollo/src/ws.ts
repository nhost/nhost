// * See https://github.com/enisdenjo/graphql-ws#graceful-restart
import { Client, ClientOptions, createClient } from 'graphql-ws'

export interface RestartableClient extends Client {
  restart(): void
  started(): boolean
}

export function createRestartableClient(options: ClientOptions): RestartableClient {
  let restartRequested = false
  let restart = () => {
    restartRequested = true
  }
  let _started = false
  const started = () => _started

  const client = createClient({
    ...options,
    on: {
      ...options.on,
      connected: () => {
        _started = true
      },
      opened: (originalSocket) => {
        const socket = originalSocket as WebSocket
        options.on?.opened?.(socket)

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
      }
    }
  })

  return {
    ...client,
    restart: () => restart(),
    started
  }
}
