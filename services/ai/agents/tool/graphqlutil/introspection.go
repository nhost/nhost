package graphqlutil

// SummaryIntrospectionQuery retrieves only the root operation names needed for a schema summary.
const SummaryIntrospectionQuery = `
query SummaryIntrospectionQuery {
  __schema {
    queryType {
      fields(includeDeprecated: true) {
        name
      }
    }
    mutationType {
      fields(includeDeprecated: true) {
        name
      }
    }
  }
}
`

// IntrospectionQuery is the GraphQL introspection query used to retrieve schema information.
const IntrospectionQuery = `
query IntrospectionQuery {
  __schema {
    queryType {
			...FullType
    }
    mutationType {
      ...FullType
    }
    types {
      ...FullType
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args {
      ...InputValue
    }
    type {
      ...TypeRef
    }
  }
  inputFields {
    ...InputValue
  }
  interfaces {
    ...TypeRef
  }
  enumValues(includeDeprecated: true) {
    name
    description
  }
  possibleTypes {
    ...TypeRef
  }
}

fragment InputValue on __InputValue {
  name
  description
  type {
    ...TypeRef
  }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`
