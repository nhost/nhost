import { setupServer } from 'msw/node'
import {
  activateMfaTotpSuccessHandler,
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctMfaTotpHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  generateMfaTotpSuccessHandler,
  resetPasswordSuccessHandler,
  sendVerificationEmailSuccessHandler,
  signOutHandler,
  signUpSuccessHandler
} from './handlers'

export const defaultSuccessHandlers = [
  activateMfaTotpSuccessHandler,
  authTokenSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  correctMfaTotpHandler,
  generateMfaTotpSuccessHandler,
  resetPasswordSuccessHandler,
  sendVerificationEmailSuccessHandler,
  signOutHandler,
  signUpSuccessHandler
]

export const server = setupServer(...defaultSuccessHandlers)

export default server
