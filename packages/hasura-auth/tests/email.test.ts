import axios from 'axios'
import faker from 'faker'
import htmlUrls from 'html-urls'
import { auth, mailhog } from './helpers'

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

    // get email that was sent
    const message = await mailhog.latestTo(email)

    if (!message?.html) {
      throw new Error('email does not exists')
    }

    // get verify email link
    const verifyEmailLink = htmlUrls({ html: message.html }).find(
      (href: { value: string; url: string; uri: string }) => href.url.includes('verifyEmail')
    )

    // verify email
    await axios.get(verifyEmailLink.url, {
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

    // get email that was sent
    const changeEmailEmail = await mailhog.latestTo(email)

    if (!changeEmailEmail?.html) {
      throw new Error('email does not exists')
    }

    // get verify email link
    const changeEmailLink = htmlUrls({ html: changeEmailEmail.html }).find(
      (href: { value: string; url: string; uri: string }) => href.url.includes('emailConfirmChange')
    )

    // verify email
    await axios.get(changeEmailLink.url, {
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

    // get email that was sent
    const verifyEmailEmail = await mailhog.latestTo(email)

    if (!verifyEmailEmail?.html) {
      throw new Error('email does not exists')
    }

    // test email link
    // get verify email link
    const verifyEmailLink = htmlUrls({ html: verifyEmailEmail.html }).find(
      (href: { value: string; url: string; uri: string }) => href.url.includes('verifyEmail')
    )

    // verify email
    await axios.get(verifyEmailLink.url, {
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
