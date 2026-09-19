/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query GetProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      email\n      newEmail\n      emailVerified\n      avatarUrl\n      hasPassword\n      metadata\n    }\n  }\n": typeof types.GetProfileDocument,
    "\n  mutation SetDisplayName($id: uuid!, $displayName: String!) {\n    updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {\n      id\n      displayName\n    }\n  }\n": typeof types.SetDisplayNameDocument,
    "\n  query GetUserMetadata($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n": typeof types.GetUserMetadataDocument,
    "\n  query GetHasPassword($id: uuid!) {\n    user(id: $id) {\n      id\n      hasPassword\n    }\n  }\n": typeof types.GetHasPasswordDocument,
    "\n  mutation SetUserMetadata($id: uuid!, $metadata: jsonb!) {\n    updateUser(pk_columns: { id: $id }, _set: { metadata: $metadata }) {\n      id\n    }\n  }\n": typeof types.SetUserMetadataDocument,
    "\n  query GetTodos {\n    todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      sort_order\n      file_id\n    }\n  }\n": typeof types.GetTodosDocument,
    "\n  mutation CreateTodo(\n    $title: String!\n    $location: String\n    $preposition: String!\n    $sortOrder: Int!\n    $isPublic: Boolean!\n  ) {\n    insert_todos_one(\n      object: {\n        title: $title\n        location: $location\n        preposition: $preposition\n        sort_order: $sortOrder\n        is_public: $isPublic\n      }\n    ) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n": typeof types.CreateTodoDocument,
    "\n  mutation UpdateTodo($id: uuid!, $changes: todos_set_input!) {\n    update_todos_by_pk(pk_columns: { id: $id }, _set: $changes) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n": typeof types.UpdateTodoDocument,
    "\n  mutation ReorderTodos($updates: [todos_updates!]!) {\n    update_todos_many(updates: $updates) {\n      affected_rows\n    }\n  }\n": typeof types.ReorderTodosDocument,
    "\n  mutation DeleteTodo($id: uuid!) {\n    delete_todos_by_pk(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteTodoDocument,
    "\n  query GetProfileVisibility($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n": typeof types.GetProfileVisibilityDocument,
    "\n  query GetDeletionMark($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n": typeof types.GetDeletionMarkDocument,
    "\n  query GetSharedList($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n        id\n        title\n        completed\n        location\n        preposition\n        sort_order\n        file_id\n      }\n    }\n  }\n": typeof types.GetSharedListDocument,
    "\n  query GetNavProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      avatarUrl\n      metadata\n    }\n  }\n": typeof types.GetNavProfileDocument,
};
const documents: Documents = {
    "\n  query GetProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      email\n      newEmail\n      emailVerified\n      avatarUrl\n      hasPassword\n      metadata\n    }\n  }\n": types.GetProfileDocument,
    "\n  mutation SetDisplayName($id: uuid!, $displayName: String!) {\n    updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {\n      id\n      displayName\n    }\n  }\n": types.SetDisplayNameDocument,
    "\n  query GetUserMetadata($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n": types.GetUserMetadataDocument,
    "\n  query GetHasPassword($id: uuid!) {\n    user(id: $id) {\n      id\n      hasPassword\n    }\n  }\n": types.GetHasPasswordDocument,
    "\n  mutation SetUserMetadata($id: uuid!, $metadata: jsonb!) {\n    updateUser(pk_columns: { id: $id }, _set: { metadata: $metadata }) {\n      id\n    }\n  }\n": types.SetUserMetadataDocument,
    "\n  query GetTodos {\n    todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      sort_order\n      file_id\n    }\n  }\n": types.GetTodosDocument,
    "\n  mutation CreateTodo(\n    $title: String!\n    $location: String\n    $preposition: String!\n    $sortOrder: Int!\n    $isPublic: Boolean!\n  ) {\n    insert_todos_one(\n      object: {\n        title: $title\n        location: $location\n        preposition: $preposition\n        sort_order: $sortOrder\n        is_public: $isPublic\n      }\n    ) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n": types.CreateTodoDocument,
    "\n  mutation UpdateTodo($id: uuid!, $changes: todos_set_input!) {\n    update_todos_by_pk(pk_columns: { id: $id }, _set: $changes) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n": types.UpdateTodoDocument,
    "\n  mutation ReorderTodos($updates: [todos_updates!]!) {\n    update_todos_many(updates: $updates) {\n      affected_rows\n    }\n  }\n": types.ReorderTodosDocument,
    "\n  mutation DeleteTodo($id: uuid!) {\n    delete_todos_by_pk(id: $id) {\n      id\n    }\n  }\n": types.DeleteTodoDocument,
    "\n  query GetProfileVisibility($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n": types.GetProfileVisibilityDocument,
    "\n  query GetDeletionMark($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n": types.GetDeletionMarkDocument,
    "\n  query GetSharedList($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n        id\n        title\n        completed\n        location\n        preposition\n        sort_order\n        file_id\n      }\n    }\n  }\n": types.GetSharedListDocument,
    "\n  query GetNavProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      avatarUrl\n      metadata\n    }\n  }\n": types.GetNavProfileDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      email\n      newEmail\n      emailVerified\n      avatarUrl\n      hasPassword\n      metadata\n    }\n  }\n"): (typeof documents)["\n  query GetProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      email\n      newEmail\n      emailVerified\n      avatarUrl\n      hasPassword\n      metadata\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetDisplayName($id: uuid!, $displayName: String!) {\n    updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {\n      id\n      displayName\n    }\n  }\n"): (typeof documents)["\n  mutation SetDisplayName($id: uuid!, $displayName: String!) {\n    updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {\n      id\n      displayName\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetUserMetadata($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n"): (typeof documents)["\n  query GetUserMetadata($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetHasPassword($id: uuid!) {\n    user(id: $id) {\n      id\n      hasPassword\n    }\n  }\n"): (typeof documents)["\n  query GetHasPassword($id: uuid!) {\n    user(id: $id) {\n      id\n      hasPassword\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetUserMetadata($id: uuid!, $metadata: jsonb!) {\n    updateUser(pk_columns: { id: $id }, _set: { metadata: $metadata }) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation SetUserMetadata($id: uuid!, $metadata: jsonb!) {\n    updateUser(pk_columns: { id: $id }, _set: { metadata: $metadata }) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetTodos {\n    todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      sort_order\n      file_id\n    }\n  }\n"): (typeof documents)["\n  query GetTodos {\n    todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      sort_order\n      file_id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateTodo(\n    $title: String!\n    $location: String\n    $preposition: String!\n    $sortOrder: Int!\n    $isPublic: Boolean!\n  ) {\n    insert_todos_one(\n      object: {\n        title: $title\n        location: $location\n        preposition: $preposition\n        sort_order: $sortOrder\n        is_public: $isPublic\n      }\n    ) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n"): (typeof documents)["\n  mutation CreateTodo(\n    $title: String!\n    $location: String\n    $preposition: String!\n    $sortOrder: Int!\n    $isPublic: Boolean!\n  ) {\n    insert_todos_one(\n      object: {\n        title: $title\n        location: $location\n        preposition: $preposition\n        sort_order: $sortOrder\n        is_public: $isPublic\n      }\n    ) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTodo($id: uuid!, $changes: todos_set_input!) {\n    update_todos_by_pk(pk_columns: { id: $id }, _set: $changes) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateTodo($id: uuid!, $changes: todos_set_input!) {\n    update_todos_by_pk(pk_columns: { id: $id }, _set: $changes) {\n      id\n      title\n      completed\n      location\n      preposition\n      is_public\n      file_id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ReorderTodos($updates: [todos_updates!]!) {\n    update_todos_many(updates: $updates) {\n      affected_rows\n    }\n  }\n"): (typeof documents)["\n  mutation ReorderTodos($updates: [todos_updates!]!) {\n    update_todos_many(updates: $updates) {\n      affected_rows\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTodo($id: uuid!) {\n    delete_todos_by_pk(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteTodo($id: uuid!) {\n    delete_todos_by_pk(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetProfileVisibility($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n"): (typeof documents)["\n  query GetProfileVisibility($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetDeletionMark($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n"): (typeof documents)["\n  query GetDeletionMark($id: uuid!) {\n    user(id: $id) {\n      id\n      metadata\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetSharedList($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n        id\n        title\n        completed\n        location\n        preposition\n        sort_order\n        file_id\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetSharedList($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {\n        id\n        title\n        completed\n        location\n        preposition\n        sort_order\n        file_id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetNavProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      avatarUrl\n      metadata\n    }\n  }\n"): (typeof documents)["\n  query GetNavProfile($id: uuid!) {\n    user(id: $id) {\n      id\n      displayName\n      avatarUrl\n      metadata\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;