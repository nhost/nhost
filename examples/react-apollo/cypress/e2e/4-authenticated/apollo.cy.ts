import { faker } from '@faker-js/faker'

context('Apollo', () => {
  const addItemTest = (sentence: string) => {
    cy.getNavBar()
      .findByRole('button', { name: /Apollo/i })
      .click()
    cy.contains('Todo list')
    cy.focused().type(sentence)
    cy.findByRole('button', { name: /Add/i }).click()
  }

  it('should add an item to the todo list when normally authenticated', () => {
    cy.signUpAndConfirmEmail()
    const sentence = faker.lorem.sentence()
    addItemTest(sentence)
    cy.get('li').contains(sentence)
  })

  it('should add an item to the todo list when anonymous', () => {
    cy.signInAnonymous()
    const sentence = faker.lorem.sentence()
    addItemTest(sentence)
    cy.get('li').contains(sentence)
  })

  it('should add an item to the todo list after a token refresh', () => {
    // * This test has a limitation: Hasura's clock is not changing, so the previous JWT will still be valid.
    cy.signUpAndConfirmEmail()
    const now = Date.now()
    cy.clock(now)
    cy.tick(4 * 7 * 24 * 60 * 60 * 1000)
    const sentence = faker.lorem.sentence()
    addItemTest(sentence)
    cy.get('li').contains(sentence)
  })

  it('should not add an item when backend is disconnected', () => {
    cy.signUpAndConfirmEmail()
    cy.disconnectBackend()
    addItemTest(faker.lorem.sentence())
    cy.contains('Network error')
    cy.get('ul').should('be.empty')
  })
})
