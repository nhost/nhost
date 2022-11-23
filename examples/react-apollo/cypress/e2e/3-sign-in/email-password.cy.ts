import totp from 'totp-generator'

import { faker } from '@faker-js/faker'
import { Decoder } from '@nuintun/qrcode'

context('Sign in with email+password', () => {
  it('should sign-in with email and password', () => {
    const email = faker.internet.email()
    const password = faker.internet.password()
    cy.signUpEmailPassword(email, password)
    cy.contains('Verification email sent').should('be.visible')
    cy.confirmEmail(email)
    cy.signOut()
    cy.contains('Sign in to the Application').should('be.visible')
    cy.signInEmailPassword(email, password)

    cy.contains('You are authenticated')
  })

  // TODO implement in the UI
  it.skip('should fail when network is not available', () => {
    const email = faker.internet.email()
    const password = faker.internet.password()
    cy.disconnectBackend()
    cy.signInEmailPassword(email, password)
    cy.contains('Error').should('be.visible')
  })

  it('should activate and sign-in with MFA', () => {
    // * Sign-up with email+password
    const email = faker.internet.email()
    const password = faker.internet.email()
    cy.signUpEmailPassword(email, password)
    cy.contains('Verification email sent').should('be.visible')
    cy.confirmEmail(email)

    cy.getNavBar()
      .findByRole('button', { name: /Profile/i })
      .click()

    cy.findByText(/Activate 2-step verification/i)
      .parent()
      .findByRole('button')
      .click()

    cy.findAllByAltText(/qrcode/i).then(async (img) => {
      // * Activate MFA
      const result = await new Decoder().scan(img.prop('src'))
      const [, params] = result.data.split('?')
      const { secret, algorithm, digits, period } = Object.fromEntries(new URLSearchParams(params))
      const code = totp(secret, {
        algorithm: algorithm.replace('SHA1', 'SHA-1'),
        digits: parseInt(digits),
        period: parseInt(period)
      })
      cy.findByPlaceholderText('Enter activation code').type(code)
      cy.findByRole('button', { name: /Activate/i }).click()
      cy.contains('MFA has been activated!!!')
      cy.signOut()

      // * Sign-in with MFA
      cy.visit('/sign-in')
      cy.findByRole('button', { name: /Continue with email \+ password/i }).click()
      cy.findByPlaceholderText('Email Address').type(email)
      cy.findByPlaceholderText('Password').type(password)
      cy.findByRole('button', { name: /Sign in/i }).click()
      cy.contains('Send 2-step verification code')
      const newCode = totp(secret, { timestamp: Date.now() })
      cy.findByPlaceholderText('One-time password').type(newCode)
      cy.findByRole('button', { name: /Send 2-step verification code/i }).click()
      cy.contains('You are authenticated')
    })
  })
})
