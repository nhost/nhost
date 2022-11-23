import axios from 'axios'
import { load } from 'cheerio'
import createMailhogClient from 'mailhog'
import { expect } from 'vitest'

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

/**
 * Get the value of `a href` that follpws a given pattern
 * in the last email sent to a given email address.
 */
export const getHtmlLink = async (email: string, pattern: string) => {
  const message = await mailhog.latestTo(email)
  if (!message?.html) {
    throw new Error(`No email found for ${email}`)
  }
  const link = load(message.html)(`a[href*="${pattern}"]`).attr('href')
  if (!link) {
    throw new Error('Link not found')
  }
  return link
}

export const signUpAndVerifyUser = async (params: SignUpParams) => {
  // sign up
  await auth.signUp(params)

  const { email } = params

  // get verify email link
  const verifyEmailLink = await getHtmlLink(email, 'verifyEmail')

  // verify email
  await axios.get(verifyEmailLink, {
    maxRedirects: 0,
    validateStatus: (status) => status === 302
  })
}

export const signUpAndInUser = async (params: SignUpParams) => {
  // sign up
  await auth.signUp(params)

  const { email, password } = params

  // get verify email link
  const verifyEmailLink = await getHtmlLink(email, 'verifyEmail')

  // verify email
  await axios.get(verifyEmailLink, {
    maxRedirects: 0,
    validateStatus: (status) => status === 302
  })

  // sign in
  const { session, error } = await auth.signIn({ email, password })

  expect(error).toBeNull()
  expect(session).toBeTruthy()
}
