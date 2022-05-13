import { setupServer } from 'msw/node'
import {
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctMfaTotpHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  singOutHandler,
  signUpSuccessHandler
} from './handlers'

export const defaultSuccessHandlers = [
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  correctMfaTotpHandler,
  singOutHandler,
  signUpSuccessHandler
]

export const server = setupServer(...defaultSuccessHandlers)

export default server
