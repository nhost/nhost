import { faker } from '@faker-js/faker'
import fetchPonyfill from 'fetch-ponyfill'
import { afterEach, describe, expect, it } from 'vitest'
import { auth, getHtmlLink, signUpAndInUser, signUpAndVerifyUser } from './helpers'

const { fetch } = fetchPonyfill()

describe('passwords', () => {
  afterEach(async () => {
    await auth.signOut()
  })

  it('should change existing password', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    await signUpAndInUser({ email, password })

    const newPassword = `${password}-new`
    const changePasswordResponse = await auth.changePassword({
      newPassword
    })

    expect(changePasswordResponse.error).toBeNull()

    await auth.signOut()

    const { session, error } = await auth.signIn({
      email,
      password: newPassword
    })

    expect(error).toBeNull()
    expect(session).toBeTruthy()
  })

  it('should reset password', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    await signUpAndVerifyUser({ email, password })

    // reset password
    const { error } = await auth.resetPassword({ email })

    expect(error).toBeNull()

    // get verify email link
    const resetPasswordLink = await getHtmlLink(email, 'passwordReset')

    // verify email
    try {
      await fetch(resetPasswordLink, { method: 'GET', redirect: 'follow' })
    } catch {
      // ignore
    }
  })
})
