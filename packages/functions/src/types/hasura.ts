export type HasuraUserClaims = {
  'x-hasura-user-id': string
  'x-hasura-default-role': string
  'x-hasura-allowed-roles': string[]
} & {
  [key: string]: string // had to add this here to avoide adding `| string[]` at the end here.
}

export type HasuraEventType = 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN'

export type HasuraEventRow = Record<string, unknown>

// TODO link to hasura docs
export type HasuraEventPayload<T extends HasuraEventRow, U extends HasuraEventType = 'UNKNOWN'> = {
  event: {
    op: U
    data: {
      old: U extends 'UNKNOWN' ? T | null : U extends 'INSERT' ? null : T
      new: U extends 'UNKNOWN' ? T | null : U extends 'DELETE' ? null : T
    }
    trace_context: {
      trace_id: string
      span_id: string
    }
  }
  created_at: string //'2022-10-16T14:43:49.644Z'
  id: string //'2c173942-a860-4a4c-ab71-9a29e2384d54'
  delivery_info: {
    max_retries: number
    current_retry: number
  }
  trigger: {
    name: string
  }
  table: {
    schema: string
    name: string
  }
}

export interface HasuraMetadataAPIPayload<Type extends string, Args> {
  type: Type
  args: Args
}

/**
 * @see{@link https://hasura.io/docs/latest/api-reference/syntax-defs/#headerfromvalue}
 */
export interface HasuraHeaderFromValue {
  name: string
  value: string
}

/**
 * @see{@link https://hasura.io/docs/latest/api-reference/syntax-defs/#headerfromenv}
 */
export interface HasuraHeaderFromEnv {
  name: string
  value_from_env: string
}

export type HasuraScheduledEventHeaders = (HasuraHeaderFromValue | HasuraHeaderFromEnv)[]
/**
 * @see{@link https://hasura.io/docs/latest/api-reference/metadata-api/scheduled-triggers/#metadata-create-scheduled-event}
 */
export interface HasuraCreateScheduledEventPayload<T>
  extends HasuraMetadataAPIPayload<
    'create_scheduled_event',
    {
      webhook: string
      schedule_at: string
      payload?: T

      headers?: (HasuraHeaderFromValue | HasuraHeaderFromEnv)[]
      retry_conf?: {
        num_retries?: number
        timeout_seconds?: number
        tolerance_seconds?: number
        retry_interval_seconds?: number
      }
      comment?: string
    }
  > {}

export interface HasuraCreateScheduledEventResult {
  message: 'success'
  /**
   * UUID of the scheduled event
   */
  event_id: string
}

/**
 * @see{@link https://hasura.io/docs/latest/api-reference/metadata-api/scheduled-triggers/#metadata-delete-scheduled-event}
 */
export interface HasuraDeleteScheduledEventPayload
  extends HasuraMetadataAPIPayload<
    'delete_scheduled_event',
    {
      type: 'one_off' | 'cron'
      event_id: string
    }
  > {}

export type HasuraMetadataPayload<T = any> =
  | HasuraCreateScheduledEventPayload<T>
  | HasuraDeleteScheduledEventPayload
