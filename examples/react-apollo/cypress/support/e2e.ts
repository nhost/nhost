import { faker } from '@faker-js/faker'

import 'cypress-mailhog'

declare global {
  namespace Cypress {
    interface Chainable {
      signUpEmailPassword(email: string, password: string): Chainable<Element>
      confirmEmail(email: string): Chainable<Element>
    }
  }
}

Cypress.Commands.add('signUpEmailPassword', (email, password) => {
  cy.visit('/sign-up')
  cy.contains('Continue with email + password').click()
  cy.get('[placeholder="First name"]').type(faker.name.firstName())
  cy.get('[placeholder="Last name"]').type(faker.name.lastName())
  cy.get('[placeholder="Email Address"]').type(email)
  cy.get('[placeholder="Password"]').type(password)
  cy.get('[placeholder="Confirm Password"]').type(password)
  cy.contains('Continue with email + password').click()
})

Cypress.Commands.add('confirmEmail', (email) => {
  cy.log('confirmEmail')
  cy.mhGetMailsByRecipient(email)
    .should('have.length', 1)
    .then(([message]) => {
      cy.visit(message.Content.Headers['X-Link'][0])
      cy.contains('You are authenticated')
    })
})
