context('Sign in with a refresh token', () => {
  it('should sign-up', () => {
    cy.quickSignUp()
  })

  it('should sign-in with a refresh token', function () {
    cy.signInToken()
    cy.visit('/profile')
    cy.contains('Profile page')
  })
})
