import { faker } from '@faker-js/faker'
import { afterEach, describe, expect, it, test } from 'vitest'
import { USER_ALREADY_SIGNED_IN } from '../src'

import { auth, signUpAndInUser } from './helpers'

describe('sign-up', () => {
  afterEach(async () => {
    await auth.signOut()
  })

  it('sign up user', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    const { session, error } = await auth.signUp({
      email,
      password
    })

    expect(error).toBeNull()
    expect(session).toBeNull()
  })

  test('sign up with metadata', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    const { session, error } = await auth.signUp({
      email,
      password,
      options: {
        metadata: {
          birthDate: '1990-01-01'
        }
      }
    })

    expect(error).toBeNull()
    expect(session).toBeNull()
  })

  it('sign up with options', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    const { session, error } = await auth.signUp({
      email,
      password,
      options: {
        displayName: faker.name.firstName(),
        locale: 'en'
      }
    })

    expect(error).toBeNull()
    expect(session).toBeNull()
  })

  // it('sign up should fail with email already in use', async () => {});
  it('sign up should fail with no password', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = ''

    const { session, error } = await auth.signUp({
      email,
      password
    })

    expect(error).toBeTruthy()
    expect(session).toBeNull()
  })

  it('sign up should fail with incorrect email', async () => {
    const email = 'not-an-email'
    const password = faker.internet.password(8)

    const { session, error } = await auth.signUp({
      email,
      password
    })

    expect(error).toBeTruthy()
    expect(session).toBeNull()
  })

  it('sign up should fail with too short password', async () => {
    const email = 'not-an-email'
    const password = faker.internet.password(1)

    const { session, error } = await auth.signUp({
      email,
      password
    })

    expect(error).toBeTruthy()
    expect(session).toBeNull()
  })

  it('should not be possible to sign up when authenticated', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    await signUpAndInUser({ email, password })
    const user = auth.getUser()
    const jwt = auth.getAccessToken()

    const { session, error } = await auth.signUp({
      email: faker.internet.email().toLocaleLowerCase(),
      password
    })

    expect(error).toEqual(USER_ALREADY_SIGNED_IN)
    expect(session).toBeNull()
    expect(auth.getAccessToken()).toEqual(jwt)
    expect(auth.getUser()).toEqual(user)
  })
})
