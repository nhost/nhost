import { faker } from '@faker-js/faker'
import { User } from '@nhost/react'

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
      signInAnonymous(): Chainable<Element>
      /** Sign in from the refresh token stored in the global state */
      visitPathWithRefreshToken(path?: string): Chainable<Element>
      /** Click on the 'Sign Out' item of the left side menu to sign out the current user */
      signOut(): Chainable<Element>
      /** Run a sign-up + authentication sequence with passwordless to use an authenticated user in other tests */
      signUpAndConfirmEmail(email?: string): Chainable<Element>
      /** Gets a confirmation email and click on the link */
      confirmEmail(email: string): Chainable<Element>
      /** Save the refresh token in the global state so it can be reused with `this.refreshToken` */
      saveRefreshToken(): Chainable<Element>
      /** Make the Nhost backend unavailable */
      disconnectBackend(): Chainable<Element>
      /** Get the left side navigation bar */
      getNavBar(): Chainable<Element>
      /** Go to the profile page */
      goToProfilePage(): Chainable<Element>
      /** Go to the home page */
      goToHomePage(): Chainable<Element>
      /** Go getch the user ID in the profile page*/
      fetchUserData(): Chainable<User>
    }
  }
}

Cypress.Commands.add('signUpEmailPassword', (email, password) => {
  cy.visit('/sign-up')
  cy.findByRole('button', { name: /Continue with email \+ password/i }).click()
  cy.findByPlaceholderText('First name').type(faker.name.firstName())
  cy.findByPlaceholderText('Last name').type(faker.name.lastName())
  cy.findByPlaceholderText('Email Address').type(email)
  cy.findByPlaceholderText('Password').type(password)
  cy.findByPlaceholderText('Confirm Password').type(password)
  cy.findByRole('button', { name: /Continue with email \+ password/i }).click()
})

Cypress.Commands.add('signUpEmailPasswordless', (email) => {
  cy.visit('/sign-up')
  cy.findByRole('button', { name: /Continue with a magic link/i }).click()
  cy.findByPlaceholderText('Email Address').type(email)
  cy.findByRole('button', { name: /Continue with email/i }).click()
})

Cypress.Commands.add('signInEmailPassword', (email, password) => {
  cy.visit('/sign-in')
  cy.findByRole('button', { name: /Continue with email \+ password/i }).click()
  cy.findByPlaceholderText('Email Address').type(email)
  cy.findByPlaceholderText('Password').type(password)
  cy.findByRole('button', { name: /Sign in/i }).click()
  cy.saveRefreshToken()
})

Cypress.Commands.add('signInAnonymous', () => {
  cy.visit('/sign-in')
  cy.findByRole('link', { name: /sign in anonymously/i }).click()
  cy.saveRefreshToken()
})

Cypress.Commands.add('visitPathWithRefreshToken', function (path = '/') {
  cy.visit(path + '#refreshToken=' + this.refreshToken)
})

Cypress.Commands.add('signOut', () => {
  cy.getNavBar()
    .findByRole('button', { name: /Sign Out/i })
    .click()
})

Cypress.Commands.add('confirmEmail', (email) => {
  cy.mhGetMailsByRecipient(email, 1)
    .should('have.length', 1)
    .then(([message]) => {
      cy.visit(message.Content.Headers['X-Link'][0])
      cy.saveRefreshToken()
    })
})

Cypress.Commands.add('signUpAndConfirmEmail', (givenEmail) => {
  const email = givenEmail || faker.internet.email()
  cy.signUpEmailPasswordless(email)
  cy.contains('Verification email sent').should('be.visible')
  cy.confirmEmail(email)
})

Cypress.Commands.add('saveRefreshToken', () => {
  cy.getNavBar()
    .findByRole('button', { name: /Sign Out/i })
    .then(() => localStorage.getItem('nhostRefreshToken'))
    .as('refreshToken')
})

Cypress.Commands.add('disconnectBackend', () => {
  cy.intercept(Cypress.env('backendUrl') + '/**', {
    forceNetworkError: true
  })
})

Cypress.Commands.add('getNavBar', () => {
  cy.findByRole(`navigation`, { name: /main navigation/i })
})

Cypress.Commands.add('goToProfilePage', () => {
  cy.getNavBar()
    .findByRole('button', { name: /Profile/i })
    .click()
})

Cypress.Commands.add('goToHomePage', () => {
  cy.getNavBar().findByRole('button', { name: /Home/i }).click()
})

Cypress.Commands.add('fetchUserData', () => {
  cy.goToProfilePage()
  cy.findByText('User information')
    .parent()
    .within(() => {
      cy.get('pre')
        .invoke('text')
        .then((text) => JSON.parse(text))
        .as('user')
    })
  return cy.get<User>('@user')
})
