import { faker } from '@faker-js/faker'
import '@testing-library/cypress/add-commands'
import 'cypress-mailhog'

declare module 'mocha' {
  export interface Context {
    refreshToken?: string
  }
}
declare global {
  namespace Cypress {
    interface Chainable {
      signUpEmailPassword(email: string, password: string): Chainable<Element>
      signUpEmailPasswordless(email: string): Chainable<Element>
      signInEmailPassword(email: string, password: string): Chainable<Element>
      signInToken(): Chainable<Element>
      signOut(): Chainable<Element>
      quickSignUp(email?: string): Chainable<Element>
      confirmEmail(email: string): Chainable<Element>
      saveRefreshToken(): Chainable<Element>
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

Cypress.Commands.add('signUpEmailPasswordless', (email) => {
  cy.visit('/sign-up')
  cy.contains('Continue with passwordless email').click()
  cy.findByPlaceholderText('Email Address').type(email)
  cy.contains('Continue with email').click()
})

Cypress.Commands.add('signInEmailPassword', (email, password) => {
  cy.visit('/sign-in')
  cy.contains('Continue with email + password').click()
  cy.findByPlaceholderText('Email Address').type(email)
  cy.findByPlaceholderText('Password').type(password)
  cy.contains('Sign in').click()
  cy.saveRefreshToken()
})

Cypress.Commands.add('signInToken', function () {
  cy.visit('/#refreshToken=' + this.refreshToken)
})

Cypress.Commands.add('signOut', () => {
  cy.contains('Sign Out').click()
})

Cypress.Commands.add('confirmEmail', (email) => {
  cy.mhGetMailsByRecipient(email)
    .should('have.length', 1)
    .then(([message]) => {
      cy.visit(message.Content.Headers['X-Link'][0])
      cy.saveRefreshToken()
    })
})

Cypress.Commands.add('quickSignUp', (givenEmail) => {
  const email = givenEmail || faker.internet.email()
  cy.signUpEmailPasswordless(email)
  cy.confirmEmail(email)
})

Cypress.Commands.add('saveRefreshToken', () => {
  cy.contains('Sign Out')
    .then(() => localStorage.getItem('nhostRefreshToken'))
    .as('refreshToken')
})
