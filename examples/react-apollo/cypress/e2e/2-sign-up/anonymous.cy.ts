import { faker } from '@faker-js/faker'

context('Anonymous users', () => {
  beforeEach(() => {
    cy.signInAnonymous()
  })

  it('should sign-up anonymously', () => {
    cy.contains('You are authenticated')
    cy.fetchUserData().its('isAnonymous').should('equal', true)
    cy.contains('You signed in anonymously')
  })

  it('should deanonymise with email+password', () => {
    cy.fetchUserData()
      .its('id')
      .then((id) => {
        const email = faker.internet.email()
        const password = faker.internet.password()
        cy.signUpEmailPassword(email, password)
        cy.contains('Verification email sent').should('be.visible')
        cy.confirmEmail(email)
        cy.contains('You are authenticated')

        cy.fetchUserData().then((user) => {
          cy.wrap(user).its('id').should('equal', id)
          cy.wrap(user).its('isAnonymous').should('equal', false)
          cy.wrap(user).its('email').should('equal', email)
        })
      })
  })

  it('should deanonymise with passwordless email', () => {
    cy.fetchUserData()
      .its('id')
      .then((id) => {
        const email = faker.internet.email()
        cy.signUpEmailPasswordless(email)
        cy.contains('Verification email sent').should('be.visible')
        cy.confirmEmail(email)
        cy.contains('Profile page')

        cy.fetchUserData().then((user) => {
          cy.wrap(user).its('id').should('equal', id)
          cy.wrap(user).its('isAnonymous').should('equal', false)
          cy.wrap(user).its('email').should('equal', email)
        })
      })
  })

  // TODO forbid email/password change, MFA activation, and password reset when the following PR is released
  // * https://github.com/nhost/hasura-auth/pull/190
})
