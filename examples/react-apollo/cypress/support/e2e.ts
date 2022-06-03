import { faker } from '@faker-js/faker'
import '@testing-library/cypress/add-commands'
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
  cy.findByPlaceholderText('First name').type(faker.name.firstName())
  cy.findByPlaceholderText('Last name').type(faker.name.lastName())
  cy.findByPlaceholderText('Email Address').type(email)
  cy.findByPlaceholderText('Password').type(password)
  cy.findByPlaceholderText('Confirm Password').type(password)
  cy.contains('Continue with email + password').click()
})

Cypress.Commands.add('confirmEmail', (email) => {
  cy.mhGetMailsByRecipient(email)
    .should('have.length', 1)
    .then(([message]) => {
      cy.visit(message.Content.Headers['X-Link'][0])
    })
})
