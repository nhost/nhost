import { faker } from '@faker-js/faker'
import fetchPonyfill from 'fetch-ponyfill'
import { afterEach, describe, expect, it } from 'vitest'
import { USER_ALREADY_SIGNED_IN } from '../src'
import { auth, getHtmlLink, signUpAndInUser, signUpAndVerifyUser } from './helpers'

const { fetch } = fetchPonyfill()

describe('sign-in', () => {
  afterEach(async () => {
    await auth.signOut()
  })

  it('sign in user with email and password', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)
    await signUpAndVerifyUser({ email, password })

    // sign in
    const { session, error } = await auth.signIn({
      email,
      password
    })

    expect(error).toBeNull()
    expect(session).toBeTruthy()

    expect(session).toMatchObject({
      accessToken: expect.any(String),
      accessTokenExpiresIn: expect.any(Number),
      refreshToken: expect.any(String),
      user: {
        id: expect.any(String),
        createdAt: expect.any(String),
        displayName: email,
        avatarUrl: expect.any(String),
        locale: 'en',
        email,
        isAnonymous: false,
        defaultRole: expect.any(String),
        roles: expect.any(Array)
      }
    })
  })

  it('sign in user with passwordless email (magic link)', async () => {
    const email = faker.internet.email().toLocaleLowerCase()

    // sign up
    const { session, error } = await auth.signIn({
      email
    })

    expect(error).toBeNull()
    expect(session).toBeNull()

    // get passwordless email ink
    const emailLink = await getHtmlLink(email, 'signinPasswordless')

    // verify email
    try {
      await fetch(emailLink, { method: 'GET', redirect: 'follow' })
    } catch {
      // ignore
    }
  })

  it('should not be possible to sign in with email+password in when already authenticated', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)
    await signUpAndInUser({ email, password })

    // Attempt to sign in again
    const { session, error } = await auth.signIn({ email, password })

    expect(error).toEqual(USER_ALREADY_SIGNED_IN)
    expect(session).toBeNull()
  })

  it('should not be possible to sign in with magic link in when already authenticated', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)
    await signUpAndInUser({ email, password })

    // Attempt to sign in again
    const { session, error } = await auth.signIn({ email })

    expect(error).toEqual(USER_ALREADY_SIGNED_IN)
    expect(session).toBeNull()
  })
})
