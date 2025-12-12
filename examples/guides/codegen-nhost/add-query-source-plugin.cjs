// Custom GraphQL Codegen plugin to add loc.source.body to generated documents
// This allows the Nhost SDK to extract the query string without needing the graphql package

/**
 * @type {import('@graphql-codegen/plugin-helpers').PluginFunction}
 */
const plugin = (_schema, documents, _config) => {
  let output = `
import { print } from 'graphql'
`

  for (const doc of documents) {
    if (!doc.document) continue

    for (const definition of doc.document.definitions) {
      if (definition.kind === 'OperationDefinition' && definition.name) {
        const operationName = definition.name.value
        const documentName = fixCaps(`${operationName}Document`)

        output += `
// Add query source to ${documentName}
if (${documentName}) {
  Object.assign(${documentName}, {
    loc: { source: { body: print(${documentName}) } }
  });
}
`
      }
    }
  }

  return output
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ex: getRoleAIDocument => GetRoleAiDocument
function fixCaps(str) {
  return capitalizeFirstLetter(str).replace(/(?<=[A-Z])([A-Z]+)(?=[A-Z])/g, (match, p1) =>
    p1.toLowerCase()
  )
}

module.exports = { plugin }
