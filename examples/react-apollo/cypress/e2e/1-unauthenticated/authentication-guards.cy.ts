context('Authentication guards', () => {
  it('should redirect to /sign-in when not authenticated', () => {
    cy.visit('/')
    cy.location('pathname').should('equal', '/sign-in')
    cy.visit('/apollo')
    cy.location('pathname').should('equal', '/sign-in')
  })
})
