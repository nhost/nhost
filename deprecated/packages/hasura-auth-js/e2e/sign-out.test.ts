import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { USER_UNAUTHENTICATED } from '../src'

import { auth, signUpAndInUser } from './helpers'

describe('sign-out', () => {
  it('should sign out', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    await signUpAndInUser({ email, password })

    expect(auth.getSession()).toBeTruthy()

    const { error } = await auth.signOut()
    expect(error).toBeNull()
    expect(auth.getSession()).toBeNull()
  })

  it('should sign out from all devices', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    await signUpAndInUser({ email, password })

    expect(auth.getSession()).toBeTruthy()

    const { error } = await auth.signOut({ all: true })
    expect(error).toBeNull()

    expect(auth.getSession()).toBeNull()
  })

  it('should not be possible to signout when not authenticated', async () => {
    const { error } = await auth.signOut()

    expect(error).toEqual(USER_UNAUTHENTICATED)
  })
})
