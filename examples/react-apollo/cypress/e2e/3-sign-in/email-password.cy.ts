import { faker } from '@faker-js/faker'

context('Sign in with email+password', () => {
  it('should sign-in with email and password', () => {
    const email = faker.internet.email()
    const password = faker.internet.password()
    cy.signUpEmailPassword(email, password)
    cy.contains('Verification email sent').should('be.visible')
    cy.confirmEmail(email)
    cy.signOut()
    cy.contains('Log in to the Application').should('be.visible')
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
})
