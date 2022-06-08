import { faker } from '@faker-js/faker'

context('Successful email+password sign-up', () => {
  it('should redirect to /sign-in when not authenticated', () => {
    cy.visit('/')
    cy.location('pathname').should('equal', '/sign-in')
  })

  it('should sign-up with email and password', () => {
    const email = faker.internet.email()
    cy.signUpEmailPassword(email, faker.internet.password())
    cy.contains('Verification email sent').should('be.visible')
    cy.confirmEmail(email)
    cy.contains('You are authenticated')
  })
})
