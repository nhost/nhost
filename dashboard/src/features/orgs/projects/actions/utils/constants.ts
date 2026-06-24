export const DEFAULT_ACTION_TIMEOUT_SECONDS = 30;

export const DEFAULT_ACTION_DEFINITION_SDL = `type Mutation {
  actionName(arg1: SampleInput!): SampleOutput
}
`;

export const DEFAULT_ACTION_TYPES_SDL = `type SampleOutput {
  accessToken: String!
}

input SampleInput {
  username: String!
  password: String!
}
`;
