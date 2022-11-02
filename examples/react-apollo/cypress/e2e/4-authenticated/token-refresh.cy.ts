import { faker } from '@faker-js/faker'

context('Token refresh', () => {
  it('should refresh token one minute before it expires', () => {
    const email = faker.internet.email()
    cy.signUpEmailPasswordless(email)
    cy.contains('Verification email sent').should('be.visible')
    const now = Date.now()
    cy.clock(now)
    cy.confirmEmail(email)

    cy.intercept(Cypress.env('backendUrl') + '/v1/auth/token').as('tokenRequest')
    cy.tick(14 * 60 * 1000)
    cy.wait('@tokenRequest').its('response.statusCode').should('eq', 200)
  })

  it('should refresh session from localStorage after 4 weeks of inactivity', () => {
    const email = faker.internet.email()
    cy.signUpEmailPasswordless(email)
    cy.contains('Verification email sent').should('be.visible')
    const now = Date.now()
    cy.clock(now)
    cy.confirmEmail(email)
    cy.contains('Profile page')

    cy.tick(4 * 7 * 24 * 60 * 60 * 1000)
    cy.reload()
    cy.contains('Profile page')
  })
})
