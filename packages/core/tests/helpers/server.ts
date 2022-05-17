import { setupServer } from 'msw/node'
import {
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctMfaTotpHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  resetPasswordSuccessHandler,
  sendVerificationEmailSuccessHandler,
  signOutHandler,
  signUpSuccessHandler
} from './handlers'

export const defaultSuccessHandlers = [
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  correctMfaTotpHandler,
  resetPasswordSuccessHandler,
  sendVerificationEmailSuccessHandler,
  signOutHandler,
  signUpSuccessHandler
]

export const server = setupServer(...defaultSuccessHandlers)

export default server
