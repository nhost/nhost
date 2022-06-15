import faker from '@faker-js/faker'

context('Apollo', () => {
  const addItemTest = () => {
    const sentence = faker.lorem.sentence()
    cy.getNavBar()
      .findByRole('button', { name: /Apollo/i })
      .click()
    cy.contains('Todo list')
    cy.focused().type(sentence)
    cy.findByRole('button', { name: /Add/i }).click()
    cy.get('li').contains(sentence)
  }

  it('should add an item to the todo list when normally authenticated', () => {
    cy.signUpAndConfirmEmail()
    addItemTest()
  })

  it('it should add an item to the todo list when anonymous', () => {
    cy.signInAnonymous()
    addItemTest()
  })
})
