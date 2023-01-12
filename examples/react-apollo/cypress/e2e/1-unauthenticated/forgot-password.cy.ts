import { faker } from '@faker-js/faker'

context('Forgot password', () => {
  it('should reset password', () => {
    const email = faker.internet.email()
    const password = faker.internet.password(8)

    cy.signUpEmailPassword(email, password)
    cy.contains('Verification email sent').should('be.visible')

    cy.visit('/sign-in')
    cy.findByRole('button', { name: /Continue with email \+ password/i }).click()
    cy.findByRole('button', { name: /Forgot Password?/i }).click()

    cy.findByPlaceholderText('Email Address').type(email)
    cy.findByRole('button', { name: /Reset your password/i }).click()

    cy.confirmEmail(email)
    cy.contains('Profile page')
  })
})
