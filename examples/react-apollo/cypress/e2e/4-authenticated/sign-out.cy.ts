context('Sign out', () => {
  beforeEach(() => {
    cy.signUpAndConfirmEmail()
  })

  it('should sign out', () => {
    cy.visitPathWithRefreshToken()
    cy.goToProfilePage()
    cy.contains('Profile page')
    cy.signOut()
    cy.contains('Sign in to the Application')
  })
})
