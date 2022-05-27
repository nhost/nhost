package graphql

// GraphQLType interface is used to specify the GraphQL type associated
// with a particular type. If a type implements this interface, the name of
// the variable used while creating the GraphQL query will be the output of
// the function defined below.
//
// In the current implementation, the GetGraphQLType function is applied to
// the zero value of the type to get the GraphQL type. So those who are
// implementing the function should avoid referencing the value of the type
// inside the function. Further, by this design, the output of the GetGraphQLType
// function will be a constant.
type GraphQLType interface {
	GetGraphQLType() string
}
