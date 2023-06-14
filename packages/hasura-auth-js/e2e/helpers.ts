import { load } from 'cheerio'
import fetchPonyfill from 'fetch-ponyfill'
import createMailhogClient from 'mailhog'
import { expect } from 'vitest'
import { HasuraAuthClient, SignUpParams } from '../src'

const { fetch } = fetchPonyfill()

const AUTH_BACKEND_URL = 'https://local.auth.nhost.run/v1'

const auth = new HasuraAuthClient({
  url: AUTH_BACKEND_URL
})

const mailhog = createMailhogClient({
  host: 'local.mailhog.nhost.run',
  protocol: 'https:',
  port: 443
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

  try {
    await fetch(verifyEmailLink, { method: 'GET', redirect: 'follow' })
  } catch {
    // ignore
  }
}

export const signUpAndInUser = async (params: SignUpParams) => {
  // sign up
  await auth.signUp(params)

  const { email, password } = params

  // get verify email link
  const verifyEmailLink = await getHtmlLink(email, 'verifyEmail')

  // verify email
  try {
    await fetch(verifyEmailLink, { method: 'GET', redirect: 'follow' })
  } catch {
    // ignore
  }

  // sign in
  const { session, error } = await auth.signIn({ email, password })

  expect(error).toBeNull()
  expect(session).toBeTruthy()
}
