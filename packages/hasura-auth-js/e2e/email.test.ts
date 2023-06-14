import { faker } from '@faker-js/faker'
import fetchPonyfill from 'fetch-ponyfill'
import { afterEach, describe, expect, it } from 'vitest'
import { auth, getHtmlLink, mailhog } from './helpers'

const { fetch } = fetchPonyfill()

describe('emails', () => {
  afterEach(async () => {
    await auth.signOut()
  })
  it('change email', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    // sign up
    await auth.signUp({
      email,
      password
    })

    // get verify email link
    const verifyEmailLink = await getHtmlLink(email, 'verifyEmail')

    // verify email
    try {
      await fetch(verifyEmailLink, { method: 'GET', redirect: 'follow' })
    } catch {
      // ignore
    }

    const signInA = await auth.signIn({
      email,
      password
    })

    expect(signInA.error).toBeNull()
    expect(signInA.session).toBeTruthy()

    // start actual test
    const changeEmailResponse = await auth.changeEmail({
      newEmail: `a+${email}`
    })

    expect(changeEmailResponse.error).toBeNull()

    // get verify email link
    const changeEmailLink = await getHtmlLink(email, 'emailConfirmChange')

    // verify email
    try {
      await fetch(changeEmailLink, { method: 'GET', redirect: 'follow' })
    } catch {
      // ignore
    }
  })

  it('reset email verification', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    // sign up
    await auth.signUp({
      email,
      password
    })

    // sign in shoudl fail
    const signInA = await auth.signIn({
      email,
      password
    })

    expect(signInA.error).toBeTruthy()
    expect(signInA.session).toBeNull()

    await auth.sendVerificationEmail({ email })

    const message = await mailhog.latestTo(email)
    expect(message?.subject).toBe('Verify your email')

    // test email link
    // get verify email link
    const verifyEmailLink = await getHtmlLink(email, 'verifyEmail')

    // verify email
    try {
      await fetch(verifyEmailLink, { method: 'GET', redirect: 'follow' })
    } catch {
      // ignore
    }

    // sign in should work
    const signInB = await auth.signIn({
      email,
      password
    })

    expect(signInB.error).toBeNull()
    expect(signInB.session).toBeTruthy()
  })
})
