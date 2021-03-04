describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should render home page', () => {
    cy.dataCy('home').should('have.text', 'Home')
  })
})
