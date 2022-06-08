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
      /** Sign in from the refresh token stored in the global state */
      signInToken(path?: string): Chainable<Element>
      /** Click on the 'Sign Out' item of the left side menu to sign out the current user */
      signOut(): Chainable<Element>
      /** Run a sign-up + authentication sequence with passwordless to use an authenticated user in other tests */
      quickSignUp(email?: string): Chainable<Element>
      /** Gets a confirmation email and click on the link */
      confirmEmail(email: string): Chainable<Element>
      /** Save the refresh token in the global state so it can be reused with `this.refreshToken` */
      saveRefreshToken(): Chainable<Element>
      /** Make the Nhost backend unavailable */
      disconnectBackend(): Chainable<Element>
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

Cypress.Commands.add('signInToken', function (path = '/') {
  cy.visit(path + '#refreshToken=' + this.refreshToken)
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
  cy.contains('Verification email sent').should('be.visible')
  cy.confirmEmail(email)
})

Cypress.Commands.add('saveRefreshToken', () => {
  cy.contains('Sign Out')
    .then(() => localStorage.getItem('nhostRefreshToken'))
    .as('refreshToken')
})

Cypress.Commands.add('disconnectBackend', () => {
  cy.intercept(Cypress.env('backendUrl') + '/**', {
    forceNetworkError: true
  })
})
