context('Sign in with a refresh token', () => {
  it('should sign-up', () => {
    cy.quickSignUp()
  })

  it('should sign-in with a refresh token', function () {
    cy.signInToken()
    cy.visit('/profile')
    cy.contains('Profile page')
  })

  it('should fail authentication when network is not available', () => {
    cy.disconnectBackend()
    cy.signInToken('/profile')
    cy.location('pathname').should('equal', '/sign-in')
  })
})
