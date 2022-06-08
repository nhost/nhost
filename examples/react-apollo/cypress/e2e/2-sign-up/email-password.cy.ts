import { faker } from '@faker-js/faker'

context('Sign up with email+password', () => {
  it('should sign-up with email and password', () => {
    const email = faker.internet.email()
    const password = faker.internet.password()
    cy.signUpEmailPassword(email, password)
    cy.contains('Verification email sent').should('be.visible')
    cy.confirmEmail(email)
    cy.contains('You are authenticated')
  })

  it('shoud raise an error when trying to sign up with an existing email', () => {
    const email = faker.internet.email()
    const password = faker.internet.password(10)
    cy.signUpEmailPassword(email, password)
    cy.contains('Verification email sent').should('be.visible')
    cy.signUpEmailPassword(email, password)
    cy.contains('Email already in use').should('be.visible')
  })

  // TODO implement in the UI
  it.skip('should fail when network is not available', () => {
    cy.disconnectBackend()
    cy.signUpEmailPassword(faker.internet.email(), faker.internet.password())
    cy.contains('Error').should('be.visible')
  })
})
