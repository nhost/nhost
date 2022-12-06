import { faker } from '@faker-js/faker'
import axios from 'axios'
import { afterEach, describe, expect, it } from 'vitest'

import { auth, getHtmlLink, mailhog } from './helpers'

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
    await axios.get(verifyEmailLink, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302
    })

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
    await axios.get(changeEmailLink, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302
    })
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

    await mailhog.deleteAll()

    await auth.sendVerificationEmail({ email })

    // make sure onle a single message exists
    const messages = await mailhog.messages()

    if (!messages) {
      throw new Error('no messages')
    }

    expect(messages.count).toBe(1)

    // test email link
    // get verify email link
    const verifyEmailLink = await getHtmlLink(email, 'verifyEmail')

    // verify email
    await axios.get(verifyEmailLink, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302
    })

    // sign in should work
    const signInB = await auth.signIn({
      email,
      password
    })

    expect(signInB.error).toBeNull()
    expect(signInB.session).toBeTruthy()
  })
})
