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
    "\n  query GetTasks {\n    tasks(order_by: { createdAt: desc }) {\n      id\n      name\n      done\n    }\n  }\n": types.GetTasksDocument,
    "\n  mutation InsertTask($task: tasks_insert_input!) {\n    insertTasks(objects: [$task]) {\n      affected_rows\n      returning {\n        id\n        name\n      }\n    }\n  }\n": types.InsertTaskDocument,
    "\n  mutation UpdateTask($id: uuid!, $task: tasks_set_input!) {\n    updateTask(pk_columns: { id: $id }, _set: $task) {\n      id\n      name\n      done\n    }\n  }\n": types.UpdateTaskDocument,
    "\n  mutation DeleteTask($id: uuid!) {\n    deleteTask(id: $id) {\n      id\n    }\n  }\n": types.DeleteTaskDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetTasks {\n    tasks(order_by: { createdAt: desc }) {\n      id\n      name\n      done\n    }\n  }\n"): (typeof documents)["\n  query GetTasks {\n    tasks(order_by: { createdAt: desc }) {\n      id\n      name\n      done\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InsertTask($task: tasks_insert_input!) {\n    insertTasks(objects: [$task]) {\n      affected_rows\n      returning {\n        id\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation InsertTask($task: tasks_insert_input!) {\n    insertTasks(objects: [$task]) {\n      affected_rows\n      returning {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTask($id: uuid!, $task: tasks_set_input!) {\n    updateTask(pk_columns: { id: $id }, _set: $task) {\n      id\n      name\n      done\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateTask($id: uuid!, $task: tasks_set_input!) {\n    updateTask(pk_columns: { id: $id }, _set: $task) {\n      id\n      name\n      done\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTask($id: uuid!) {\n    deleteTask(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteTask($id: uuid!) {\n    deleteTask(id: $id) {\n      id\n    }\n  }\n"];

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