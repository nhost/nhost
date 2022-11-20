export type HasuraUserClaims = {
  'x-hasura-user-id': string
  'x-hasura-default-role': string
  'x-hasura-allowed-roles': string[]
} & {
  [key: string]: string // had to add this here to avoide adding `| string[]` at the end here.
}

/**
 * Name of the operation. Can only be "INSERT", "UPDATE", "DELETE", "MANUAL", or "UNKNOWN".
 */
export type HasuraEventType = 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL' | 'UNKNOWN'

/**
 * Key-value pairs of column name and their values of the table
 */
export type HasuraEventColumnValues = Record<string, unknown>

/**
 * The payload of a Hasura event
 * @see{@link https://hasura.io/docs/latest/event-triggers/payload/#json-payload}
 */
export type HasuraEventPayload<T extends HasuraEventColumnValues, U extends HasuraEventType> = {
  event: {
    op: U extends 'UNKNOWN' ? 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL' : U
    /**
     * Key-value pairs of session variables (i.e. "x-hasura-*" variables) and their values (NULL if no session variables found)
     */
    session_variables: Record<string, string>
    data: {
      /**
       * Column values before the update or delete. Null when the event is of type "INSERT" or manually triggered.
       */
      old: U extends 'UNKNOWN' ? T | null : U extends 'INSERT' | 'MANUAL' ? null : T
      /**
       * Column values after the update, or values on creation. Current row when the event manually triggered. Null when the event is of type "DELETE".
       */
      new: U extends 'UNKNOWN' ? T | null : U extends 'DELETE' ? null : T
    }
    trace_context: {
      trace_id: string
      span_id: string
    }
  }
  /**
   * Timestamp at which event was created
   */
  created_at: string
  /**
   * UUID identifier for the event
   */
  id: string
  delivery_info: {
    /**
     * Maximum retries for this event
     */
    max_retries: number
    /**
     * Current retry number
     */
    current_retry: number
  }
  trigger: {
    /**
     * Name of the trigger
     */
    name: string
  }
  table: {
    /**
     * Name of the schema for the table
     */
    schema: string
    /**
     * Name of the table
     */
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
  /**
   * Name of the header
   */
  name: string
  /**
   * Value of the header
   */
  value: string
}

/**
 * @see{@link https://hasura.io/docs/latest/api-reference/syntax-defs/#headerfromenv}
 */
export interface HasuraHeaderFromEnv {
  /**
   * Name of the header
   */
  name: string
  /**
   * Name of the environment variable which holds the value of the header
   */
  value_from_env: string
}

export type HasuraScheduledEventHeaders = (HasuraHeaderFromValue | HasuraHeaderFromEnv)[]

/**
 * Payload used to create a scheduled event
 * @see{@link https://hasura.io/docs/latest/api-reference/metadata-api/scheduled-triggers/#metadata-create-scheduled-event}
 */
export interface HasuraCreateScheduledEventPayload<T>
  extends HasuraMetadataAPIPayload<
    'create_scheduled_event',
    {
      /**
       * A String value which supports templating environment variables enclosed in {{ and }}.
       * @example
       * https://{{ACTION_API_DOMAIN}}/create-user
       */
      webhook: string
      /**
       * The time at which the invocation should be invoked. (ISO8601 format)
       */
      schedule_at: string
      /**
       * Any JSON payload which will be sent when the webhook is invoked.
       */
      payload?: T & Record<string, unknown> // TODO check tyoe

      /**
       * List of headers to be sent with the webhook
       */
      headers?: (HasuraHeaderFromValue | HasuraHeaderFromEnv)[]
      /**
       * Retry configuration if scheduled event delivery fails
       */
      retry_conf?: {
        /**
         * Number of times to retry delivery.
         * @default 0
         */
        num_retries?: number
        /**
         * Number of seconds to wait between each retry.
         * @default 10
         */
        timeout_seconds?: number
        /**
         * Number of seconds to wait for response before timing out
         * @default 60
         */
        tolerance_seconds?: number
        /**
         * Number of seconds between scheduled time and actual delivery time that is acceptable.
         * If the time difference is more than this, then the event is dropped.
         * @default 21600 (6 hours)
         */
        retry_interval_seconds?: number
      }
      /**
       * Custom comment.
       */
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
      /**
       * Type of the event trigger.
       */
      type: 'one_off' | 'cron'
      /**
       * The id of the scheduled event.
       */
      event_id: string
    }
  > {}

export type HasuraMetadataPayload<T = any> =
  | HasuraCreateScheduledEventPayload<T>
  | HasuraDeleteScheduledEventPayload
