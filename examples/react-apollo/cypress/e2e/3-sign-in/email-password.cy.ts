import { faker } from '@faker-js/faker'

context('Sign in with email+password', () => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  it('should sign-up', () => {
    cy.signUpEmailPassword(email, password)
    cy.contains('Verification email sent').should('be.visible')
    cy.confirmEmail(email)
  })

  it('should sign-in with email and password', function () {
    cy.signInEmailPassword(email, password)
    cy.contains('You are authenticated')
  })
})
