import { faker } from '@faker-js/faker'
import { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/typescript-types'
import { rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a network error when trying to sign up with webauthn.
 */
export const signUpEmailSecurityKeyNetworkErrorHandler = rest.post(
  `${BASE_URL}/signup/webauthn`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign up with webauthn.
 */
export const signUpEmailSecurityKeyInternalErrorHandler = rest.post(
  `${BASE_URL}/signup/webauthn`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock a conflicting email error when trying to sign up with webauthn.
 */
export const signUpEmailSecurityKeyConflictErrorHandler = rest.post(
  `${BASE_URL}/signup/webauthn`,
  (_req, res, ctx) => {
    return res(
      ctx.status(409),
      ctx.json({
        status: 409,
        message: 'Email already in use',
        error: 'email-already-in-use'
      })
    )
  }
)

/**
 * Request handler for MSW to mock a successful first step of webauthn sign up.
 * the server.
 */
export const signUpEmailSecurityKeySuccessHandler = rest.post(
  `${BASE_URL}/signup/webauthn`,
  (_req, res, ctx) => {
    return res(
      ctx.json<PublicKeyCredentialCreationOptionsJSON>({
        challenge: faker.datatype.string(30),
        user: {
          id: faker.datatype.uuid(),
          name: faker.internet.email(),
          displayName: faker.name.firstName()
        },
        excludeCredentials: [],
        pubKeyCredParams: [],
        rp: {
          name: faker.company.name(),
          id: faker.internet.domainName()
        }
      })
    )
  }
)

/**
 * Request handler for MSW to mock a successful webauthn sign up request when session is not returned by
 * the server.
 */
export const signUpVerifySecurityKeySuccessHandler = rest.post(
  `${BASE_URL}/signup/webauthn/verify`,
  (_req, res, ctx) => {
    return res(
      ctx.json<{ mfa: Mfa | null; session: NhostSession | null }>({
        session: null,
        mfa: null
      })
    )
  }
)

/**
 * Request handler for MSW to mock a successful webauthn sign up request when session is returned by
 * the server.
 */
export const signUpVerifySecurityKeySuccessWithSessionHandler = rest.post(
  `${BASE_URL}/signup/webauthn/verify`,
  (_req, res, ctx) => {
    return res(
      ctx.json<{ mfa: Mfa | null; session: NhostSession | null }>({
        session: {
          user: fakeUser,
          accessTokenExpiresIn: 900,
          accessToken: faker.datatype.string(40),
          refreshToken: faker.datatype.uuid()
        },
        mfa: null
      })
    )
  }
)
