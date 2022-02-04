import axios from 'axios'
import htmlUrls from 'html-urls'
import createMailhogClient from 'mailhog'
import { HasuraAuthClient, SignUpParams } from '../src'

const AUTH_BACKEND_URL = 'http://localhost:1337/v1/auth'

const auth = new HasuraAuthClient({
  url: AUTH_BACKEND_URL
})

const mailhog = createMailhogClient({
  host: '127.0.0.1',
  port: 8025
})

export { auth, mailhog }

export const signUpAndVerifyUser = async (params: SignUpParams) => {
  // sign up
  await auth.signUp(params)

  const { email } = params

  // get email that was sent
  const message = await mailhog.latestTo(email)

  if (!message?.html) {
    throw new Error('email does not exists')
  }

  // get verify email link
  const verifyEmailLink = htmlUrls({ html: message.html }).find(
    (href: { value: string; url: string; uri: string }) => href.url.includes('verifyEmail')
  )

  // verify email
  await axios.get(verifyEmailLink.url, {
    maxRedirects: 0,
    validateStatus: (status) => status === 302
  })
}

export const signUpAndInUser = async (params: SignUpParams) => {
  // sign up
  await auth.signUp(params)

  const { email, password } = params

  // get email that was sent
  const message = await mailhog.latestTo(email)

  if (!message?.html) {
    throw new Error('email does not exists')
  }

  // get verify email link
  const verifyEmailLink = htmlUrls({ html: message.html }).find(
    (href: { value: string; url: string; uri: string }) => href.url.includes('verifyEmail')
  )

  // verify email
  await axios.get(verifyEmailLink.url, {
    maxRedirects: 0,
    validateStatus: (status) => status === 302
  })

  // sign in
  const { session, error } = await auth.signIn({ email, password })

  expect(error).toBeNull()
  expect(session).toBeTruthy()
}
