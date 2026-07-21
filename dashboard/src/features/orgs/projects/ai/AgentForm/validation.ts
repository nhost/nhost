import * as Yup from 'yup';
import { GraphiteAgentProviders_Enum } from '@/utils/__generated__/graphite.graphql';

function isValidJson(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

const mcpServerSchema = Yup.object({
  url: Yup.string().required('URL is required.'),
  headers: Yup.string()
    .defined()
    .test('valid-json', 'Headers must be valid JSON.', isValidJson),
  requireApproval: Yup.boolean().defined(),
  toolOverrides: Yup.string()
    .defined()
    .test('valid-json', 'Tool overrides must be valid JSON.', isValidJson),
});

export const validationSchema = Yup.object({
  name: Yup.string().required('The name is required.'),
  description: Yup.string().defined(),
  instructions: Yup.string().required('The instructions are required.'),
  provider: Yup.string()
    .oneOf(
      Object.values(GraphiteAgentProviders_Enum),
      'Please select a valid provider.',
    )
    .required('The provider is required.'),
  model: Yup.string().required('The model is required.'),
  webSearchEnabled: Yup.boolean().defined(),
  webSearchProvider: Yup.string().defined(),
  webSearchRequireApproval: Yup.boolean().defined(),
  webFetchEnabled: Yup.boolean().defined(),
  webFetchRequireApproval: Yup.boolean().defined(),
  graphqlEnabled: Yup.boolean().defined(),
  graphqlRequireApprovalQueries: Yup.boolean().defined(),
  graphqlRequireApprovalMutations: Yup.boolean().defined(),
  mcpServers: Yup.array().of(mcpServerSchema).defined(),
});

export type AgentFormValues = Yup.InferType<typeof validationSchema>;
