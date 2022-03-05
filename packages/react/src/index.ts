import { suppressConsoleMessage } from './utils'

/* Suppress NextJS/SSR warning. It triggers a warning whereas xstate does not use
 * useLayoutEffect on server-side
 * See https://gist.github.com/gaearon/e7d97cdf38a2907924ea12e4ebdf3c85
 */
suppressConsoleMessage('useLayoutEffect does nothing on the server', 'error')

export * from './hooks'
export * from './provider'
