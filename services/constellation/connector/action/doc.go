// Package action exposes and executes synchronous Hasura Actions from parsed
// metadata.
//
// The package owns action and custom-type schema generation, role reachability,
// fine-grained filtering of invalid action metadata, hardened HTTP webhook
// dispatch, and GraphQL response shaping for synchronous action results.
package action
