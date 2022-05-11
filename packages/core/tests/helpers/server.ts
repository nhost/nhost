import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { BASE_URL } from './config'
import { authTokenSuccessHandler } from './generalHandlers'
import { correctEmailPasswordHandler, correctPasswordlessEmailHandler } from './signInHandlers'

export const defaultSuccessHandlers = [
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler
]
export const server = setupServer(...defaultSuccessHandlers)

export default server
