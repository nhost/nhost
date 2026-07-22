export const DEFAULT_ACTION_TIMEOUT_SECONDS = 30;

export const actionKindOptions = [
  {
    label: 'Synchronous',
    value: 'synchronous',
  },
  {
    label: 'Asynchronous',
    value: 'asynchronous',
  },
] as const;

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
