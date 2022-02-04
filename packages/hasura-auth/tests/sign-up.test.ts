import faker from 'faker'
import { auth } from './helpers'

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
})
