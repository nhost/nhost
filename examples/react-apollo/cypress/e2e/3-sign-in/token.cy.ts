context('Automatic sign-in with a refresh token', () => {
  it('should sign in automatically with a refresh token', () => {
    cy.signUpAndConfirmEmail()
    cy.contains('Profile page')
    cy.clearLocalStorage()
    cy.reload()
    cy.contains('Sign in to the Application')
    cy.visitPathWithRefreshToken('/profile')
    cy.contains('Profile page')
  })

  it('should fail automatic sign-in when network is not available', () => {
    cy.signUpAndConfirmEmail()
    cy.contains('Profile page')
    cy.disconnectBackend()
    cy.clearLocalStorage()
    cy.reload()
    cy.contains('Sign in to the Application')
    cy.visitPathWithRefreshToken('/profile')
    cy.contains('Could not sign in automatically. Retrying to get user information..')
  })
})
