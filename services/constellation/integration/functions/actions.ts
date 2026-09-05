import type { Request, Response } from "express";

// Action webhook handler for the integration/parity env, served at
// `${NHOST_FUNCTIONS_URL}/actions` (file basename -> route). It mirrors the
// behaviours of Hasura's server/tests-py webhook handlers so the action test
// buckets ported from graphql-engine can drive deterministic webhook responses.
//
// Hasura POSTs the action payload:
//   { action: { name }, input: {...args}, session_variables: {...}, request_query }
//
// Behaviour is selected by the action NAME PREFIX, so a single handler serves
// many dynamically-created actions (each test creates a uniquely-named action
// pointing here):
//
//   echo*    -> 200, returns the input args object as the output object.
//   reflect* -> returns `input.payload` VERBATIM with HTTP status `input.status`
//               (default 200). Lets the nullability/shape matrix drive any raw
//               response (object / array / scalar / null / nested-null) while
//               Constellation enforces the declared output type.
//   mirror*  -> like reflect, but also sets response headers: a Set-Cookie plus
//               every name/value in the `input.headers` object. For the
//               response-header-forwarding tests.
//   fail* /
//   error*   -> HTTP status `input.status` (default 400) with a Hasura action
//               error body { message, code?, extensions? } taken from the input.
//   slow*    -> sleeps `input.ms` (default 5000) then returns `input.payload`.
//               For the timeout tests.
//   (default) -> echoes the input args object.
//
// The webhook secret is enforced exactly like the other integration functions;
// the test harness injects `x-nhost-webhook-secret: {value_from_env:
// NHOST_WEBHOOK_SECRET}` into every action it creates, so this also exercises
// header injection + value_from_env resolution.

interface ActionPayload {
  action?: { name?: string };
  input?: Record<string, unknown>;
  session_variables?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default async function handler(req: Request, res: Response) {
  const webhookSecret = req.get("x-nhost-webhook-secret");
  if (webhookSecret !== process.env.NHOST_WEBHOOK_SECRET) {
    res.status(401).send("Unauthorized");
    return;
  }

  const body = (req.body ?? {}) as ActionPayload;
  const name = (body.action?.name ?? "").toLowerCase();
  const input = body.input ?? {};

  const starts = (prefix: string) => name.startsWith(prefix);

  if (starts("slow")) {
    await sleep(asInt(input.ms, 5000));
    res.status(200).json(input.payload ?? {});
    return;
  }

  if (starts("fail") || starts("error")) {
    const errorBody: Record<string, unknown> = {
      message: input.message ?? "action failed",
    };
    if (input.code !== undefined) errorBody.code = input.code;
    if (input.extensions !== undefined) errorBody.extensions = input.extensions;
    res.status(asInt(input.status, 400)).json(errorBody);
    return;
  }

  if (starts("mirror")) {
    res.setHeader("Set-Cookie", String(input.cookie ?? "session=abc123; Path=/; HttpOnly"));
    const extraHeaders = (input.headers ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(extraHeaders)) {
      res.setHeader(key, String(value));
    }
    res.status(asInt(input.status, 200)).json("payload" in input ? input.payload : input);
    return;
  }

  if (starts("reflect")) {
    res.status(asInt(input.status, 200)).json("payload" in input ? input.payload : input);
    return;
  }

  // echo* and default: return the input args object as the output object.
  res.status(200).json(input);
}
