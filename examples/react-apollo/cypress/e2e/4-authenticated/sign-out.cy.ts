context('Sign out', () => {
  it('should sign-up', () => {
    cy.quickSignUp()
  })

  it('should sign out', function () {
    cy.signInToken()
    cy.visit('/profile')
    cy.contains('Profile page')
    cy.signOut()
    cy.contains('Log in to the Application')
  })
})
