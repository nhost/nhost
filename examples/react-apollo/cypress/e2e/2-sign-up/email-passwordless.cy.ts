import { faker } from '@faker-js/faker'

context('Sign up with passwordless email', () => {
  it('should sign-up with passwordless email', () => {
    const email = faker.internet.email()
    cy.signUpEmailPasswordless(email)
    cy.contains('Verification email sent').should('be.visible')
    cy.confirmEmail(email)
    cy.contains('Profile page')
  })
})
