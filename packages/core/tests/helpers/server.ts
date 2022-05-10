import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { BASE_URL } from './config'
import { authTokenSuccessHandler } from './generalHandlers'
import { correctEmailPasswordHandler } from './signInHandlers'

export const defaultSuccessHandlers = [authTokenSuccessHandler, correctEmailPasswordHandler]
export const server = setupServer(...defaultSuccessHandlers)

export default server
