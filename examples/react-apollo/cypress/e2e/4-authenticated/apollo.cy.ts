import faker from '@faker-js/faker'

context('Apollo', () => {
  beforeEach(() => {
    cy.signUpAndConfirmEmail()
  })

  it('should add an item to the todo list', () => {
    const sentence = faker.lorem.sentence()
    cy.getNavBar().contains('Apollo').click()
    cy.contains('Todo list')
    cy.focused().type(sentence)
    cy.get('button').contains('Add').click()
    cy.get('ul').contains(sentence)
  })
})
