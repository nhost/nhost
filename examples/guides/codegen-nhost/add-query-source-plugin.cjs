// Custom GraphQL Codegen plugin to add loc.source.body to generated documents
// This allows the Nhost SDK to extract the query string without needing the graphql package

const { print } = require('graphql');

/**
 * @type {import('@graphql-codegen/plugin-helpers').PluginFunction}
 */
const plugin = (_schema, documents, _config) => {
  let output = '';

  for (const doc of documents) {
    if (!doc.document) continue;

    for (const definition of doc.document.definitions) {
      if (definition.kind === 'OperationDefinition' && definition.name) {
        const operationName = definition.name.value;
        const documentName = `${operationName}Document`;

        // Create a document with just this operation
        const singleOpDocument = {
          kind: 'Document',
          definitions: [definition],
        };

        // Use graphql print to convert AST to string
        const source = print(singleOpDocument);

        output += `
// Add query source to ${documentName}
if (${documentName}) {
  Object.assign(${documentName}, {
    loc: { source: { body: ${JSON.stringify(source)} } }
  });
}
`;
      }
    }
  }

  return output;
};

module.exports = { plugin };
