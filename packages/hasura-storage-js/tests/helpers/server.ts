import { setupServer } from 'msw/node'
import { authTokenSuccessHandler } from './handlers'

export const defaultSuccessHandlers = [authTokenSuccessHandler]

export const server = setupServer(...defaultSuccessHandlers)

export default server
