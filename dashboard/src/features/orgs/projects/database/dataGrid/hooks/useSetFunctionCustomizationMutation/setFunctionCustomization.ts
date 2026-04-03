import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { SetFunctionCustomizationArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface SetFunctionCustomizationVariables {
  args: SetFunctionCustomizationArgs;
}

export default async function setFunctionCustomization({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & SetFunctionCustomizationVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'pg_set_function_customization',
        args,
      },
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
