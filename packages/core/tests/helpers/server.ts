import { setupServer } from 'msw/node'
import {
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctMfaTotpHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  signUpSuccessHandler
} from './handlers'

export const defaultSuccessHandlers = [
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  correctMfaTotpHandler,
  signUpSuccessHandler
]

export const server = setupServer(...defaultSuccessHandlers)

export default server
