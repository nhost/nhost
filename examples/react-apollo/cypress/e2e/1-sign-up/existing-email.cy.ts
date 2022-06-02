import { faker } from '@faker-js/faker'

context('Failed attempt to sign up with an email already present in the database', () => {
  it('shoud raise an error when trying to sign up with an existing email', () => {
    const email = faker.internet.email()
    const password = faker.internet.password(10)
    cy.signUpEmailPassword(email, password)
    cy.signUpEmailPassword(email, password)
    cy.contains('Email already in use').should('be.visible')
  })
})
