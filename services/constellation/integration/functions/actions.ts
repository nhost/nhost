type Request = {
  body: unknown;
  method: string;
  get(name: string): string | undefined;
};

type ResponseSender = {
  set(name: string, value: string): ResponseSender;
  json(payload: unknown): void;
};

type Response = {
  status(code: number): ResponseSender;
};

declare const process: {
  env: {
    NHOST_WEBHOOK_SECRET?: string;
  };
};

type SessionVariables = Record<string, string | undefined>;

type ActionPayload = {
  action?: {
    name?: string;
  };
  input?: Record<string, unknown>;
  session_variables?: SessionVariables;
};

const WEBHOOK_SECRET_HEADER = 'x-nhost-webhook-secret';
const ACTION_ECHO_HEADER = 'x-action-echo';

function getObjectBody(req: Request): Record<string, unknown> {
  if (typeof req.body !== 'object' || req.body === null) {
    return {};
  }

  return req.body as Record<string, unknown>;
}

function getPayload(req: Request): ActionPayload {
  return getObjectBody(req) as ActionPayload;
}

function getNumber(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (
    typeof value !== 'number' ||
    !(value > Number.NEGATIVE_INFINITY && value < Number.POSITIVE_INFINITY)
  ) {
    throw new Error(`${key} must be a finite number`);
  }

  return value;
}

function getString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string`);
  }

  return value;
}

function sessionValue(
  sessionVariables: SessionVariables,
  key: string,
): string | null {
  return sessionVariables[key] ?? sessionVariables[key.toLowerCase()] ?? null;
}

function assertWebhookSecret(req: Request): void {
  const expectedSecret = process.env.NHOST_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return;
  }

  const actualSecret = req.get(WEBHOOK_SECRET_HEADER);
  if (actualSecret !== expectedSecret) {
    throw new Error('invalid webhook secret');
  }
}

function sendActionError(res: Response, status: number, message: string): void {
  res.status(status).json({ message });
}

export default function handler(req: Request, res: Response): void {
  const transformedAction = req.get('x-action-name') === 'transformEcho';
  if (
    (!transformedAction && req.method !== 'POST') ||
    (transformedAction && req.method !== 'PATCH')
  ) {
    sendActionError(res, 405, 'method not allowed');
    return;
  }

  try {
    assertWebhookSecret(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unauthorized';
    sendActionError(res, 401, message);
    return;
  }

  if (transformedAction) {
    const body = getObjectBody(req);
    const message = getString(body, 'message');
    const role = getString(body, 'role');
    const nested = getString(body, 'nested');

    res
      .status(202)
      .set('x-transform-response', 'transform-response')
      .json({
        data: {
          text: `${message}:${nested}`,
          role,
          contentType: req.get('content-type') ?? null,
        },
      });
    return;
  }

  const payload = getPayload(req);
  const input = payload.input ?? {};
  const sessionVariables = payload.session_variables ?? {};

  try {
    switch (payload.action?.name) {
      case 'addNumbers': {
        const a = getNumber(input, 'a');
        const b = getNumber(input, 'b');
        res.status(200).json({ sum: a + b });
        return;
      }

      case 'echoHeaders': {
        res.status(200).json({
          message: getString(input, 'message'),
          role: sessionValue(sessionVariables, 'x-hasura-role') ?? 'unknown',
          userId: sessionValue(sessionVariables, 'x-hasura-user-id'),
          forwardedHeader: req.get(ACTION_ECHO_HEADER) ?? null,
          webhookSecretPresent: req.get(WEBHOOK_SECRET_HEADER) !== undefined,
        });
        return;
      }

      case 'login': {
        const email = getString(input, 'email');
        getString(input, 'password');

        res.status(200).json({
          accessToken: `action-token:${email}`,
          userId: 'action-user-0001',
          role: 'user',
        });
        return;
      }

      case 'asyncEcho': {
        res.status(200).json({
          message: getString(input, 'message'),
          role: sessionValue(sessionVariables, 'x-hasura-role') ?? 'unknown',
        });
        return;
      }

      case 'actionProfiles': {
        res.status(200).json([
          {
            label: 'engineering-manager',
            userId: '550e8400-e29b-41d4-a716-446655440011',
          },
          {
            label: 'hr-manager',
            userId: '550e8400-e29b-41d4-a716-446655440001',
          },
        ]);
        return;
      }

      default:
        sendActionError(
          res,
          400,
          `unknown action: ${payload.action?.name ?? '<missing>'}`,
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'invalid action request';
    sendActionError(res, 400, message);
  }
}
