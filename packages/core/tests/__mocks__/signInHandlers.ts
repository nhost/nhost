import { rest } from 'msw'
import { NhostSession } from '../../src/types'

const baseUrl = 'http://localhost:1337/v1/auth'

export const signInWithEmailPasswordSuccessHandler = rest.post(
  `${baseUrl}/signin/email-password`,
  (_req, res, ctx) => {
    return res(
      ctx.json<{ session: NhostSession }>({
        session: {
          user: {
            id: '1',
            createdAt: '2020-01-01T00:00:00.000Z',
            displayName: 'John Doe',
            avatarUrl: 'https://avatars0.githubusercontent.com/u/1?s=460&v=4',
            locale: 'en',
            isAnonymous: false,
            emailVerified: true,
            defaultRole: 'user',
            roles: ['user', 'me'],
            phoneNumber: null,
            phoneNumberVerified: false,
            activeMfaType: null,
            metadata: {}
          },
          accessTokenExpiresIn: 5000,
          accessToken: '',
          refreshToken: ''
        }
      })
    )
  }
)

export const incorrectEmailPasswordHandler = rest.post(
  `${baseUrl}/signin/email-password`,
  (_req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({
        status: 401,
        error: 'invalid-email-password',
        message: 'Incorrect email or password'
      })
    )
  }
)

export const successHandlers = [signInWithEmailPasswordSuccessHandler]
