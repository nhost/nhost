export const DEFAULT_ACTION_TIMEOUT_SECONDS = 30;

export const DEFAULT_ACTION_DEFINITION_SDL = `type Mutation {
  processPayment(input: PaymentInput!): PaymentResult
}
`;

export const DEFAULT_ACTION_TYPES_SDL = `input PaymentInput {
  orderId: String!
  amount: Float!
  currency: String!
}

type PaymentResult {
  transactionId: String!
  status: String!
}
`;
