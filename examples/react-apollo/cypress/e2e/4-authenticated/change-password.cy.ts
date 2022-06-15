import faker from '@faker-js/faker'

context('Change password', () => {
  it('should change password', () => {
    const email = faker.internet.email()
    cy.signUpAndConfirmEmail(email)
    const newPassword = faker.internet.password()
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
})
