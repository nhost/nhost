import { setupServer } from 'msw/node'
import {
  activateMfaTotpSuccessHandler,
  authTokenSuccessHandler,
  changeEmailSuccessHandler,
  changePasswordSuccessHandler,
  correctAnonymousHandler,
  correctEmailPasswordHandler,
  correctMfaTotpHandler,
  correctPasswordlessEmailHandler,
  correctPasswordlessSmsHandler,
  correctPasswordlessSmsOtpHandler,
  createPATSuccessHandler,
  deamonymisationSuccessfulHandler,
  generateMfaTotpSuccessHandler,
  patSignInSuccessHandler,
  resetPasswordSuccessHandler,
  sendVerificationEmailSuccessHandler,
  signOutHandler,
  signUpSuccessHandler
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
  deamonymisationSuccessfulHandler,
  patSignInSuccessHandler,
  createPATSuccessHandler
]

export const server = setupServer(...defaultSuccessHandlers)

export default server
