// Package action prepares Hasura Action GraphQL schemas from parsed metadata.
//
// The package owns action and custom-type schema generation, including role
// reachability and fine-grained filtering of invalid action metadata. Runtime
// webhook execution is intentionally not registered with production connector
// builds yet; synchronous execution is added by a later phase.
package action
