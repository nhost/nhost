import faker from 'faker'
import { auth, signUpAndInUser } from './helpers'

describe('sign-out', () => {
  it('sign in user with email and password', async () => {
    const email = faker.internet.email().toLocaleLowerCase()
    const password = faker.internet.password(8)

    await signUpAndInUser({ email, password })

    expect(auth.getSession()).toBeTruthy()

    await auth.signOut()

    expect(auth.getSession()).toBeNull()
  })
})
