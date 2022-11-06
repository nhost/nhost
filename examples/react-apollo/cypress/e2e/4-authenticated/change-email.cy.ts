import { faker } from '@faker-js/faker'

context('Change email', () => {
  it('should change email', () => {
    const newEmail = faker.internet.email()
    cy.signUpAndConfirmEmail()
    cy.findByPlaceholderText('New email').type(newEmail)
    cy.findByText(/Change Email/i)
      .parent()
      .findByRole('button')
      .click()
    cy.contains('Please check your inbox and follow the link to confirm the email change').should(
      'be.visible'
    )
    cy.signOut()
    cy.confirmEmail(newEmail)
    cy.contains('Profile page')
  })

  it('should not accept an invalid email', () => {
    const newEmail = faker.random.alphaNumeric()
    cy.signUpAndConfirmEmail()
    cy.findByPlaceholderText('New email').type(newEmail)
    cy.findByText(/Change Email/i)
      .parent()
      .findByRole('button')
      .click()
    cy.contains('Email is incorrectly formatted').should('be.visible')
  })
})
