context('Sign out', () => {
  beforeEach(() => {
    cy.signUpAndConfirmEmail()
  })

  it('should sign out', () => {
    cy.visitPathWithRefreshToken()
    cy.visit('/profile')
    cy.contains('Profile page')
    cy.signOut()
    cy.contains('Log in to the Application')
  })
})
