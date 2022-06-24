context('Sign in with a refresh token', () => {
  it('should sign-in with a refresh token', () => {
    cy.signUpAndConfirmEmail()
    cy.contains('Profile page')
    cy.clearLocalStorage()
    cy.reload()
    cy.contains('Log in to the Application')
    cy.visitPathWithRefreshToken('/profile')
    cy.contains('Profile page')
  })

  it('should fail authentication when network is not available', () => {
    cy.signUpAndConfirmEmail()
    cy.contains('Profile page')
    cy.disconnectBackend()
    cy.clearLocalStorage()
    cy.reload()
    cy.contains('Log in to the Application')
    cy.visitPathWithRefreshToken('/profile')
    cy.location('pathname').should('equal', '/sign-in')
  })
})
