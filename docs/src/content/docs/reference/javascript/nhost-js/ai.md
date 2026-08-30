---
title: AI
---

This is the main module to interact with Nhost's AI agents.
Typically you would use this module via the main [Nhost client](/reference/javascript/nhost-js/main#createclient)
but you can also use it directly if you have a specific use case.

# Import

```ts
import { createClient } from "@nhost/nhost-js";
import type { AgentEvent } from "@nhost/nhost-js/ai";
```

# Usage

Create a session for an existing agent and stream typed events back from a
`sendMessage` call:

```ts
const subdomain = "local";
const region = "local";

const nhost = createClient({ subdomain, region });

const session = await nhost.ai.newAgentSession({ agentID: "agent-uuid" });

const collected: AgentEvent[] = [];
for await (const event of session.sendMessage("Hello agent")) {
  collected.push(event);

  if (event.type === "content_delta") {
    // Stream a token to stdout, build up an in-progress reply, etc.
  } else if (event.type === "tool_call") {
    // The agent is invoking a tool — `event.input` is the parsed arguments.
  } else if (event.type === "tool_result") {
    // Result of the tool call — `event.content` is whatever the tool returned.
  }
}
```

# Tool approval

When the agent has tools configured with `require_approval`, the stream
will yield an `approval_required` event. The event carries methods to
approve or deny the pending tool calls; calling one of them resumes the
same iterator with events from the continued stream:

```ts
const nhost = createClient({ subdomain: "local", region: "local" });
const session = await nhost.ai.newAgentSession({ agentID: "agent-uuid" });

const seen: string[] = [];
for await (const event of session.sendMessage("Search for X")) {
  seen.push(event.type);

  if (event.type === "approval_required") {
    // Inspect event.toolCalls and decide. Other options:
    //   - event.denyAll()
    //   - event.approve(['tc_1'])
    //   - event.deny(['tc_1'])
    //   - event.respond([{ toolCallID: 'tc_1', approved: true }])
    await event.approveAll();
  }
}
```

# Resuming an existing session

Use `resumeSession` to fetch the stored messages of a session and continue
the conversation. The returned session has a populated `history` field
plus the same `sendMessage` as a new session:

```ts
const nhost = createClient({ subdomain: "local", region: "local" });

const session = await nhost.ai.resumeSession({
  sessionID: "existing-session-id",
});

// Inspect past messages — assistant text and tool calls are flattened into
// separate entries so `history` can be iterated with the same switch as
// live events.
for (const msg of session.history) {
  if (msg.type === "user") {
    // render the user bubble
  } else if (msg.type === "assistant") {
    // render the assistant bubble
  } else if (msg.type === "tool_call") {
    // render the tool invocation — msg.name, msg.input
  } else if (msg.type === "tool_result") {
    // render the tool result — msg.toolName, msg.content
  }
}

// The session continues — sendMessage targets the same conversation.
const stream = session.sendMessage("anything else?");
for await (const _event of stream) {
  /* drain */
}
```

# Classes

## AgentSession

A handle to an existing agent session. Create one with `Client.newAgentSession`,
`Client.resumeSession`, or `Client.agentSession`.

### Constructors

#### Constructor

```ts
new AgentSession(params: object): AgentSession;
```

##### Parameters

| Parameter              | Type                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params`               | \{ `agentID?`: `string`; `baseURL`: `string`; `enhancedFetch`: [`FetchFunction`](./fetch#fetchfunction); `history?`: [`AgentHistoryMessage`](#agenthistorymessage)[]; `id`: `string`; `userID?`: `string`; \} |
| `params.agentID?`      | `string`                                                                                                                                                                                                       |
| `params.baseURL`       | `string`                                                                                                                                                                                                       |
| `params.enhancedFetch` | [`FetchFunction`](./fetch#fetchfunction)                                                                                                                                                                      |
| `params.history?`      | [`AgentHistoryMessage`](#agenthistorymessage)[]                                                                                                                                                                |
| `params.id`            | `string`                                                                                                                                                                                                       |
| `params.userID?`       | `string`                                                                                                                                                                                                       |

##### Returns

[`AgentSession`](#agentsession)

### Properties

| Property                                 | Modifier   | Type                                            | Description                                                                                                                                                                                                      |
| ---------------------------------------- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-agentid"></a> `agentID?` | `readonly` | `string`                                        | -                                                                                                                                                                                                                |
| <a id="property-history"></a> `history`  | `readonly` | [`AgentHistoryMessage`](#agenthistorymessage)[] | Messages already persisted on this session. Empty for sessions returned by `newAgentSession`; populated for sessions returned by `resumeSession`. Live events from `sendMessage` are not appended to this array. |
| <a id="property-id"></a> `id`            | `readonly` | `string`                                        | -                                                                                                                                                                                                                |
| <a id="property-userid"></a> `userID?`   | `readonly` | `string`                                        | Hasura user id stored on the session row, when available.                                                                                                                                                        |

### Methods

#### sendMessage()

```ts
sendMessage(message: string, options?: RequestInit): AgentResponseStream;
```

Send a message to the agent and stream back typed events.

When an `approval_required` event arrives, call one of its decision
methods before advancing the iterator. The same iterator then continues
with events from the approval response.

##### Parameters

| Parameter  | Type          |
| ---------- | ------------- |
| `message`  | `string`      |
| `options?` | `RequestInit` |

##### Returns

[`AgentResponseStream`](#agentresponsestream)

# Interfaces

## AgentResponseStream

The stream returned by [AgentSession.sendMessage](#sendmessage).

### Extends

- `AsyncIterable`&lt;[`AgentEvent`](#agentevent)&gt;

---

## ApprovalRequiredEvent

Approval request for one or more pending tool calls.

The stream pauses on this event. Call one of the `approve*` / `deny*` /
`respond` methods on the event to submit every decision; the same async
iterator will then continue yielding events from the resumed response.

If you advance the iterator without calling any of the methods, the
iterator ends and the agent remains waiting for a decision.

### Properties

#### toolCalls

```ts
toolCalls: object[];
```

| Name               | Type      |
| ------------------ | --------- |
| `id`               | `string`  |
| `input`            | `unknown` |
| `name`             | `string`  |
| `requiresApproval` | `boolean` |

#### type

```ts
type: "approval_required";
```

### Methods

#### approve()

```ts
approve(toolCallIDs: string[]): Promise<void>;
```

Approve the listed tool call ids; any not listed are denied.

##### Parameters

| Parameter     | Type       |
| ------------- | ---------- |
| `toolCallIDs` | `string`[] |

##### Returns

`Promise`&lt;`void`&gt;

#### approveAll()

```ts
approveAll(): Promise<void>;
```

Approve every pending tool call in this event.

##### Returns

`Promise`&lt;`void`&gt;

#### deny()

```ts
deny(toolCallIDs: string[]): Promise<void>;
```

Deny the listed tool call ids; any not listed are approved.

##### Parameters

| Parameter     | Type       |
| ------------- | ---------- |
| `toolCallIDs` | `string`[] |

##### Returns

`Promise`&lt;`void`&gt;

#### denyAll()

```ts
denyAll(): Promise<void>;
```

Deny every pending tool call in this event.

##### Returns

`Promise`&lt;`void`&gt;

#### respond()

```ts
respond(decisions: object[]): Promise<void>;
```

Submit exactly one decision for every tool call in this event.

##### Parameters

| Parameter   | Type       |
| ----------- | ---------- |
| `decisions` | `object`[] |

##### Returns

`Promise`&lt;`void`&gt;

---

## AssistantHistoryMessage

Assistant text already persisted in an agent session.

### Properties

#### content

```ts
content: string;
```

#### createdAt

```ts
createdAt: string;
```

#### id

```ts
id: string;
```

#### type

```ts
type: "assistant";
```

---

## Client

AI client interface.

### Properties

#### baseURL

```ts
baseURL: string;
```

Base URL for the AI service (e.g. `https://<sub>.ai.<region>.nhost.run/v1`).

### Methods

#### agentSession()

```ts
agentSession(sessionID: string, agentID?: string): AgentSession;
```

Get a handle for an existing session without fetching its history. Use
this when you only want to send messages and don't need the past
exchange (e.g. fire-and-forget scripts). For a loaded history, use
[Client.resumeSession](#resumesession).

##### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `sessionID` | `string` |
| `agentID?`  | `string` |

##### Returns

[`AgentSession`](#agentsession)

#### newAgentSession()

```ts
newAgentSession(input: NewAgentSessionInput, options?: RequestInit): Promise<AgentSession>;
```

Create a new agent session via GraphQL and return a handle for sending
messages to it.

`options` is forwarded to the underlying GraphQL request — e.g. pass
`{ headers: { 'x-hasura-role': 'user' } }` to impersonate a role for
this single call without installing role middleware globally.

##### Parameters

| Parameter  | Type                                            |
| ---------- | ----------------------------------------------- |
| `input`    | [`NewAgentSessionInput`](#newagentsessioninput) |
| `options?` | `RequestInit`                                   |

##### Returns

`Promise`&lt;[`AgentSession`](#agentsession)&gt;

#### pushChainFunction()

```ts
pushChainFunction(chainFunction: ChainFunction): void;
```

Add a middleware function to the AI client's fetch chain. The main Nhost
client uses this to attach authentication and admin-session middleware.

##### Parameters

| Parameter       | Type                                      |
| --------------- | ----------------------------------------- |
| `chainFunction` | [`ChainFunction`](./fetch#chainfunction) |

##### Returns

`void`

#### resumeSession()

```ts
resumeSession(input: ResumeSessionInput, options?: RequestInit): Promise<AgentSession>;
```

Resume an existing agent session: fetch its stored messages via GraphQL
and return an [AgentSession](#agentsession) whose `history` field is populated
with the past exchange. The returned session's `sendMessage` continues
the same conversation.

`options` is forwarded to the GraphQL query — useful for per-call role
impersonation or an `AbortSignal`.

##### Parameters

| Parameter  | Type                                        |
| ---------- | ------------------------------------------- |
| `input`    | [`ResumeSessionInput`](#resumesessioninput) |
| `options?` | `RequestInit`                               |

##### Returns

`Promise`&lt;[`AgentSession`](#agentsession)&gt;

---

## ContentDeltaEvent

A chunk of streamed text from the agent's reply.

### Properties

#### content

```ts
content: string;
```

#### type

```ts
type: "content_delta";
```

---

## ErrorEvent

A terminal error reported after an SSE response has started.

### Properties

#### error

```ts
error: string;
```

#### type

```ts
type: "error";
```

---

## NewAgentSessionInput

Input for [Client.newAgentSession](#newagentsession).

### Properties

#### agentID

```ts
agentID: string;
```

The agent to create a session for.

---

## ResumeSessionInput

Input for [Client.resumeSession](#resumesession).

### Properties

#### sessionID

```ts
sessionID: string;
```

The existing session to resume.

---

## StopReasonEvent

Emitted when the agent's response was cut short for a non-normal reason.

Currently fires for `max_tokens` (response was truncated at the model's
output limit) and `refusal` (the model declined to answer). Normal
completions (`end_turn`) and tool-use turns do not emit this event.

### Properties

#### reason

```ts
reason: "max_tokens" | "refusal";
```

#### type

```ts
type: "stop_reason";
```

---

## ToolCallEvent

A complete tool invocation prepared by the agent.

### Properties

#### input

```ts
input: unknown;
```

#### name

```ts
name: string;
```

#### toolCallID

```ts
toolCallID: string;
```

#### type

```ts
type: "tool_call";
```

---

## ToolCallHistoryMessage

A tool call stored on a persisted assistant message.

### Properties

#### createdAt

```ts
createdAt: string;
```

#### id

```ts
id: string;
```

Database id of the assistant message that carried this tool call.

#### input

```ts
input: unknown;
```

#### name

```ts
name: string;
```

#### toolCallID?

```ts
optional toolCallID?: string;
```

#### type

```ts
type: "tool_call";
```

---

## ToolDeniedEvent

A tool call denied by the user.

### Properties

#### content

```ts
content: string;
```

#### toolCallID

```ts
toolCallID: string;
```

#### toolName

```ts
toolName: string;
```

#### type

```ts
type: "tool_denied";
```

---

## ToolResultEvent

The result returned from executing a tool.

### Properties

#### content

```ts
content: string;
```

#### toolCallID

```ts
toolCallID: string;
```

#### toolName

```ts
toolName: string;
```

#### type

```ts
type: "tool_result";
```

---

## ToolResultHistoryMessage

A persisted tool result.

### Properties

#### content

```ts
content: string;
```

#### createdAt

```ts
createdAt: string;
```

#### id

```ts
id: string;
```

#### toolCallID?

```ts
optional toolCallID?: string;
```

#### toolName

```ts
toolName: string;
```

#### type

```ts
type: "tool_result";
```

---

## ToolUseStartEvent

Emitted when the agent starts using a tool, before arguments are known.

### Properties

#### name

```ts
name: string;
```

#### type

```ts
type: "tool_use_start";
```

---

## UserHistoryMessage

A user message already persisted in an agent session.

### Properties

#### content

```ts
content: string;
```

#### createdAt

```ts
createdAt: string;
```

#### id

```ts
id: string;
```

#### type

```ts
type: "user";
```

# Type Aliases

## AgentEvent

```ts
type AgentEvent =
  | ContentDeltaEvent
  | ToolUseStartEvent
  | ToolCallEvent
  | ToolResultEvent
  | ApprovalRequiredEvent
  | ToolDeniedEvent
  | StopReasonEvent
  | ErrorEvent;
```

---

## AgentHistoryMessage

```ts
type AgentHistoryMessage =
  | UserHistoryMessage
  | AssistantHistoryMessage
  | ToolCallHistoryMessage
  | ToolResultHistoryMessage;
```

# Functions

## createAPIClient()

```ts
function createAPIClient(
  baseURL: string,
  graphqlClient: Client,
  chainFunctions?: ChainFunction[],
): Client;
```

Create an AI API client.

`graphqlClient` is required so that `newAgentSession` can issue the
`insertAiAgentSession` mutation without duplicating GraphQL plumbing.

### Parameters

| Parameter        | Type                                        | Default value | Description                                             |
| ---------------- | ------------------------------------------- | ------------- | ------------------------------------------------------- |
| `baseURL`        | `string`                                    | `undefined`   | Base URL of the AI service, including the `/v1` suffix. |
| `graphqlClient`  | [`Client`](./graphql#client)               | `undefined`   | The GraphQL client used to insert new sessions.         |
| `chainFunctions` | [`ChainFunction`](./fetch#chainfunction)[] | `[]`          | Initial middleware chain for the AI HTTP fetcher.       |

### Returns

[`Client`](#client)
