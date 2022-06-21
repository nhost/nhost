context('Sign out', () => {
  beforeEach(() => {
    cy.signUpAndConfirmEmail()
  })

  it('should sign out', () => {
    cy.visitPathWithRefreshToken()
    cy.goToProfilePage()
    cy.contains('Profile page')
    cy.signOut()
    cy.contains('Log in to the Application')
  })
})
