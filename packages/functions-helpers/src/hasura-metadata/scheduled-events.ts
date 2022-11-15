import { add, Duration } from 'date-fns'

import { hasuraClient } from './client'
import {
  HasuraCreateScheduledEventResult,
  HasuraMetadataPayload,
  HasuraScheduledEventHeaders
} from './types'

interface ScheduleEventPayload<T = any> {
  headers?: Record<string, string | { env: string } | { value: string }>
  payload?: T
  comment?: string
  retry?: {
    numberRetries?: number
    timeoutSeconds?: number
    toleranceSeconds?: number
    intervalSeconds?: number
  }
}

type ScheduleEventTime = Date | Duration

interface ScheduledEvent {
  id: string
  cancel: () => Promise<void>
}

export const createScheduledEvent = async <T extends Record<string, unknown> = {}>(
  endpoint: string,
  time: ScheduleEventTime,
  options?: ScheduleEventPayload<T>
): Promise<ScheduledEvent> => {
  const when = time instanceof Date ? time : add(new Date(), time)

  const headers: HasuraScheduledEventHeaders = []
  if (endpoint.startsWith(process.env.NHOST_BACKEND_URL!)) {
    // * When the webhook URL is inside the Nhost app, we automatically append the Nhost webhook to the headers
    headers.push({ name: 'nhost-webhook-secret', value: 'NHOST_WEBHOOK_SECRET' })
  }
  if (options?.headers) {
    headers.push(
      ...Object.entries(options.headers).map(([name, value]) => {
        if (typeof value === 'string') {
          return { name, value }
        }
        if ('env' in value) {
          return { name, value_from_env: value.env }
        }
        return { name, value: value.value }
      })
    )
  }
  const payload: HasuraMetadataPayload<T> = {
    type: 'create_scheduled_event',
    args: {
      webhook: endpoint,
      schedule_at: when.toISOString(),
      comment: options?.comment,
      payload: options?.payload,
      retry_conf: options?.retry && {
        num_retries: options.retry.numberRetries,
        timeout_seconds: options.retry.timeoutSeconds,
        tolerance_seconds: options.retry.toleranceSeconds,
        retry_interval_seconds: options.retry.intervalSeconds
      },
      headers
    }
  }

  const {
    data: { event_id: id },
    status,
    statusText
  } = await hasuraClient.post<HasuraCreateScheduledEventResult>('/v1/metadata', payload)
  if (status !== 200) {
    throw new Error(
      `Impossible to create scheduled event ${endpoint}. The Hasura metadata API returned the status ${status}: ${statusText}`
    )
  }

  return {
    id,
    cancel: () => deleteScheduledEvent(id)
  }
}

export const deleteScheduledEvent = async (id: string): Promise<void> => {
  const payload: HasuraMetadataPayload = {
    type: 'delete_scheduled_event',
    args: { event_id: id, type: 'one_off' }
  }
  const { status, statusText } = await hasuraClient.post<HasuraCreateScheduledEventResult>(
    '/v1/metadata',
    payload
  )
  if (status !== 200) {
    throw new Error(
      `Impossible to remove scheduled event ${id}. The Hasura metadata API returned the status ${status}: ${statusText}`
    )
  }
}
