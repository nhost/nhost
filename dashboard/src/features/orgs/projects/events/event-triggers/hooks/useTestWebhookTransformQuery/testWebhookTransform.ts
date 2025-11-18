import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  TestWebhookTransformArgs,
  TestWebhookTransformOperation,
  TestWebhookTransformResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

/**
 * This function tests the webhook transform for a given webhook URL and request body.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns The response from the test webhook transform operation.
 *
 * Example payload:
 * {
 *   "type": "test_webhook_transform",
 *   "args": {
 *     "webhook_url": "https://httpbin.org/post/delay/1",
 *     "body": {
 *       "event": {
 *         "op": "INSERT",
 *         "data": {
 *           "old": null,
 *           "new": {
 *             "id": "id",
 *             "title": "title"
 *           }
 *         },
 *         "trace_context": {
 *           "trace_id": "501ad47ed3570385",
 *           "span_id": "d586cc98cee55ad1"
 *         }
 *       },
 *       "created_at": "2025-10-26T19:17:03.976Z",
 *       "id": "2c173942-a860-4a4c-ab71-9a29e2384d54",
 *       "delivery_info": {
 *         "max_retries": 0,
 *         "current_retry": 0
 *       },
 *       "trigger": {
 *         "name": "mytabletrigger"
 *       },
 *       "table": {
 *         "schema": "public",
 *         "name": "mytable"
 *       }
 *     },
 *     "env": {
 *       "SOMEENV": "https://httpbin.org/post"
 *     },
 *     "session_variables": {
 *       "x-hasura-admin-secret": "xxx"
 *     },
 *     "request_transform": {
 *       "version": 2,
 *       "url": "{{$base_url}}/template",
 *       "query_params": {},
 *       "template_engine": "Kriti"
 *     }
 *   }
 * }
 */

export interface TestWebhookTransformVariables {
  args: TestWebhookTransformArgs;
}

export default async function testWebhookTransform({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions &
  TestWebhookTransformVariables): Promise<TestWebhookTransformResponse> {
  try {
    const operation: TestWebhookTransformOperation = {
      type: 'test_webhook_transform',
      args: {
        ...args,
      },
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as TestWebhookTransformResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
