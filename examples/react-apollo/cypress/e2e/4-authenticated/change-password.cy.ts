import { faker } from '@faker-js/faker'

context('Change password', () => {
  it('should change password', () => {
    const email = faker.internet.email()
    const newPassword = faker.internet.password()
    cy.signUpAndConfirmEmail(email)
    cy.findByPlaceholderText('New password').type(newPassword)
    cy.findByText(/Change Password/i)
      .parent()
      .findByRole('button')
      .click()
    cy.contains('Password changed successfully').should('be.visible')
    cy.signOut()
    cy.signInEmailPassword(email, newPassword)
    cy.contains('You are authenticated')
  })

  it('should not accept an invalid password', () => {
    const newPassword = faker.random.alphaNumeric(2)
    cy.signUpAndConfirmEmail()
    cy.findByPlaceholderText('New password').type(newPassword)
    cy.findByText(/Change Password/i)
      .parent()
      .findByRole('button')
      .click()
    cy.contains('Password is incorrectly formatted').should('be.visible')
  })
})
