import { setupServer } from 'msw/node'
import {
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler
} from './handlers'

export const defaultSuccessHandlers = [
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler
]

export const server = setupServer(...defaultSuccessHandlers)

export default server
