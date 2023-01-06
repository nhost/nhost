context('File uploads', () => {
  it('should upload a single file', () => {
    cy.signUpAndConfirmEmail()
    cy.findByRole('button', { name: /Storage/i }).click()
    cy.findByRole('button', { name: /Drag a file here or click to select/i })
      .children('input[type=file]')
      .selectFile(
        {
          contents: Cypress.Buffer.from('file contents'),
          fileName: 'file.txt',
          mimeType: 'text/plain',
          lastModified: Date.now()
        },
        { force: true }
      )
      .parent()
      .contains('Successfully uploaded')
  })

  it('should upload two files using the same single file uploader', () => {
    cy.signUpAndConfirmEmail()
    cy.findByRole('button', { name: /Storage/i }).click()
    cy.findByRole('button', { name: /Drag a file here or click to select/i })
      .children('input[type=file]')
      .selectFile(
        {
          contents: Cypress.Buffer.from('file contents'),
          fileName: 'file.txt',
          mimeType: 'text/plain',
          lastModified: Date.now()
        },
        { force: true }
      )
      .selectFile(
        {
          contents: Cypress.Buffer.from('file contents'),
          fileName: 'file.txt',
          mimeType: 'text/plain',
          lastModified: Date.now()
        },
        { force: true }
      )
      .parent()
      .contains('Successfully uploaded')
  })

  it('should upload multiple files', () => {
    const files: Required<Cypress.FileReferenceObject>[] = [
      {
        contents: Cypress.Buffer.from('file contents'),
        fileName: 'file1.txt',
        mimeType: 'text/plain',
        lastModified: Date.now()
      },
      {
        contents: Cypress.Buffer.from('file contents'),
        fileName: 'file2.txt',
        mimeType: 'text/plain',
        lastModified: Date.now()
      }
    ]
    cy.signUpAndConfirmEmail()
    cy.findByRole('button', { name: /Storage/i }).click()
    cy.findByRole('button', { name: /Drag files here or click to select/i })
      .children('input[type=file]')
      .selectFile(files, { force: true })
    cy.findByRole('button', { name: /Upload/i }).click()
    cy.findByRole('button', { name: /Successfully uploaded/i }).should('be.visible')
    cy.findByRole('table').within(() => {
      files.forEach((file) => {
        cy.contains(file.fileName).parent().findByTitle('success').should('exist')
      })
    })
  })
})
