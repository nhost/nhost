// Package action exposes and executes Hasura Actions from parsed metadata.
//
// The package owns action and custom-type schema generation, role reachability,
// fine-grained filtering of invalid action metadata, hardened HTTP webhook
// dispatch, GraphQL response shaping, and asynchronous action-log workers.
package action
