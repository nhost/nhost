import { setupServer } from 'msw/node'
import {
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler
} from './handlers'

export const defaultSuccessHandlers = [
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler
]
export const server = setupServer(...defaultSuccessHandlers)

export default server
