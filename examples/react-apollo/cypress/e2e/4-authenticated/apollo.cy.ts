import faker from '@faker-js/faker'

context('Apollo', () => {
  beforeEach(() => {
    cy.signUpAndConfirmEmail()
  })

  it('should add an item to the todo list', () => {
    const sentence = faker.lorem.sentence()
    cy.getNavBar()
      .findByRole('button', { name: /Apollo/i })
      .click()
    cy.contains('Todo list')
    cy.focused().type(sentence)
    cy.findByRole('button', { name: /Add/i }).click()
    cy.get('ul').contains(sentence)
  })
})
