context('Sign in with a refresh token', () => {
  it('should sign-up', () => {
    cy.signUpAndConfirmEmail()
  })

  it('should sign-in with a refresh token', () => {
    cy.visitPathWithRefreshToken()
    cy.visit('/profile')
    cy.contains('Profile page')
  })

  it('should fail authentication when network is not available', () => {
    cy.disconnectBackend()
    cy.visitPathWithRefreshToken('/profile')
    cy.location('pathname').should('equal', '/sign-in')
  })
})
