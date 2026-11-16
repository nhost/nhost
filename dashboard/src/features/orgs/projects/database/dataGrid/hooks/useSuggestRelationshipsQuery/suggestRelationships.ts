import type {
  SuggestRelationshipsArgs,
  SuggestRelationshipsResponse,
} from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';

export interface SuggestRelationshipsOptions {
  appUrl: string;
  adminSecret: string;
}

export interface SuggestRelationshipsVariables {
  args: SuggestRelationshipsArgs;
}

export default async function suggestRelationships({
  appUrl,
  adminSecret,
  args,
}: SuggestRelationshipsOptions & SuggestRelationshipsVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'pg_suggest_relationships',
        args,
      },
      {
        appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data as SuggestRelationshipsResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
