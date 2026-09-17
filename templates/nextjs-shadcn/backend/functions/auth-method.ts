import type { Request, Response } from 'express';

// Tells the sign-in page which second step to show for an email address.
//
// This needs the admin secret, because an anonymous visitor must not be able
// to read auth.users. Unknown addresses deliberately answer the same as an
// account with no password: both go down the email-code path, which is also
// how signing up works, so the response does not confirm whether an account
// exists. It does reveal that a known address has a password set, which is
// the same tradeoff every email-first sign-in makes. The auth service rate
// limits the calls that follow; put a rate limit in front of this one too
// before exposing it on a public site.

const graphqlURL = process.env.NHOST_GRAPHQL_URL as string;
const adminSecret = process.env.NHOST_ADMIN_SECRET as string;

const HasPassword = `query HasPassword($email: citext!) {
  users(where: { email: { _eq: $email } }, limit: 1) {
    hasPassword
  }
}`;

export default async (req: Request, res: Response): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'use POST' });
    return;
  }

  const email = (req.body as { email?: unknown } | null)?.email;
  if (typeof email !== 'string' || email === '') {
    res.status(400).json({ error: 'send { "email": "you@example.com" }' });
    return;
  }

  const response = await fetch(graphqlURL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query: HasPassword, variables: { email } }),
  });

  if (!response.ok) {
    res.status(502).json({ error: 'could not look up the account' });
    return;
  }

  const result = (await response.json()) as {
    data?: { users?: Array<{ hasPassword?: boolean }> };
    errors?: unknown[];
  };

  if (result.errors) {
    res.status(502).json({ error: 'could not look up the account' });
    return;
  }

  res
    .status(200)
    .json({ hasPassword: result.data?.users?.[0]?.hasPassword === true });
};
