/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel-plugin for production.
 */
const documents = {
    "\n  query GetPrivatePosts($userId: uuid!) {\n    posts(where: { user_id: { _eq: $userId } }) {\n      id\n      title\n    }\n  }\n": types.GetPrivatePostsDocument,
    "\n  mutation InsertPost($post: posts_insert_input!) {\n    insertPosts(objects: [$post]) {\n      affected_rows\n      returning {\n        id\n        title\n      }\n    }\n  }\n": types.InsertPostDocument,
    "\n  mutation DeletePost($id: uuid!) {\n    deletePost(id: $id) {\n      id\n    }\n  }\n": types.DeletePostDocument,
    "\n  query GetPublicPosts {\n    posts {\n      id\n      title\n    }\n  }\n": types.GetPublicPostsDocument,
    "\n  subscription GetPublicPostsSub {\n    posts {\n      id\n      title\n    }\n  }\n": types.GetPublicPostsSubDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPrivatePosts($userId: uuid!) {\n    posts(where: { user_id: { _eq: $userId } }) {\n      id\n      title\n    }\n  }\n"): (typeof documents)["\n  query GetPrivatePosts($userId: uuid!) {\n    posts(where: { user_id: { _eq: $userId } }) {\n      id\n      title\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InsertPost($post: posts_insert_input!) {\n    insertPosts(objects: [$post]) {\n      affected_rows\n      returning {\n        id\n        title\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation InsertPost($post: posts_insert_input!) {\n    insertPosts(objects: [$post]) {\n      affected_rows\n      returning {\n        id\n        title\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeletePost($id: uuid!) {\n    deletePost(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeletePost($id: uuid!) {\n    deletePost(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPublicPosts {\n    posts {\n      id\n      title\n    }\n  }\n"): (typeof documents)["\n  query GetPublicPosts {\n    posts {\n      id\n      title\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription GetPublicPostsSub {\n    posts {\n      id\n      title\n    }\n  }\n"): (typeof documents)["\n  subscription GetPublicPostsSub {\n    posts {\n      id\n      title\n    }\n  }\n"];

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = gql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
**/
export function graphql(source: string): unknown;

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;