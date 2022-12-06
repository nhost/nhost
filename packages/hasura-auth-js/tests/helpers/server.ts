import { setupServer } from 'msw/node'
import {
  activateMfaTotpSuccessHandler,
  authTokenSuccessHandler,
  changeEmailSuccessHandler,
  changePasswordSuccessHandler,
  correctEmailPasswordHandler,
  correctMfaTotpHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  generateMfaTotpSuccessHandler,
  resetPasswordSuccessHandler,
  sendVerificationEmailSuccessHandler,
  signOutHandler,
  signUpSuccessHandler,
  correctAnonymousHandler,
  deamonymisationSuccessfulHandler
} from './handlers'

export const defaultSuccessHandlers = [
  activateMfaTotpSuccessHandler,
  authTokenSuccessHandler,
  changeEmailSuccessHandler,
  changePasswordSuccessHandler,
  correctEmailPasswordHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  correctMfaTotpHandler,
  generateMfaTotpSuccessHandler,
  resetPasswordSuccessHandler,
  sendVerificationEmailSuccessHandler,
  signOutHandler,
  signUpSuccessHandler,
  correctAnonymousHandler,
  deamonymisationSuccessfulHandler
]

export const server = setupServer(...defaultSuccessHandlers)

export default server
