import type { Session } from '@nhost/nhost-js/auth';
import * as Linking from 'expo-linking';
import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';
import { goTo } from '@/lib/goTo';
import { bounded, TIMED_OUT } from '@/lib/utils';
import { bareAuth, LINK_TYPE_PARAM, nhost } from './client';
import { APP_SCHEME, appUrl } from './env';
import { LINK_ERROR } from './errors';
import { PASSWORD_RESET_LINK_TYPE, startPasswordReset } from './passwordReset';
import { generatePKCEPair, randomToken } from './pkce';
import { START_TIMEOUT_MS, startSession } from './startSession';

// Every flow that ends in a link back into the app carries a PKCE challenge,
// and the link a one-time code. Auth creates no session until the app trades
// the code and the verifier it kept for one, so a link opened by another app
// that claims the scheme, or on another device, signs nobody in.

export const CODE_PARAM = 'code';
export const FLOW_PARAM = 'flow';

// What auth sends instead of a code for a request with no challenge, such as
// a link edited by hand. The app only takes codes, so it is dropped unread.
const REFRESH_TOKEN_PARAM = 'refreshToken';

// Read here, and never passed on to a screen.
const LINK_PARAMS = [
  CODE_PARAM,
  LINK_TYPE_PARAM,
  FLOW_PARAM,
  REFRESH_TOKEN_PARAM,
];

// What auth appends to `redirectTo` when a flow fails.
const ERROR_PARAMS = ['error', 'errorDescription'];

/** A link into the app as a route: its path and its decoded query, in order. */
export type IncomingLink = { path: string; params: [string, string][] };

function splitAt(value: string, separator: string): [string, string] {
  const at = value.indexOf(separator);
  return at === -1 ? [value, ''] : [value.slice(0, at), value.slice(at + 1)];
}

const decode = (value: string): string =>
  decodeURIComponent(value.replace(/\+/g, ' '));

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/;

/**
 * `input` as a route in this app, or null when it is not one. React Native's
 * global `URL` cannot parse a custom scheme, so the string is read by hand.
 * The host of `nhost-starter://account/?…` is the route's first segment, as in
 * `nhost-starter:///account?…`; `nhost-starter:?…` is the root, and a bare
 * `/account?…` is taken as it is.
 */
export function parseLink(input: string): IncomingLink | null {
  const [target, query] = splitAt(splitAt(input, '#')[0], '?');
  const scheme = SCHEME.exec(target);
  let path: string;
  if (scheme) {
    if (scheme[1].toLowerCase() !== APP_SCHEME) {
      return null;
    }
    path = target.slice(scheme[0].length);
  } else if (target.startsWith('/')) {
    path = target;
  } else {
    return null;
  }

  const params: [string, string][] = [];
  for (const part of query.split('&')) {
    if (part === '') {
      continue;
    }
    const [key, value] = splitAt(part, '=');
    try {
      params.push([decode(key), decode(value)]);
    } catch {
      return null;
    }
  }

  return { path: `/${path.split('/').filter(Boolean).join('/')}`, params };
}

/** The route `link` names, as Expo Router takes it. */
export function linkHref({ path, params }: IncomingLink): string {
  const query = params
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  return query === '' ? path : `${path}?${query}`;
}

const param = (link: IncomingLink, name: string): string | undefined =>
  link.params.find(([key]) => key === name)?.[1];

const without = (link: IncomingLink, names: string[]): IncomingLink => ({
  path: link.path,
  params: link.params.filter(([key]) => !names.includes(key)),
});

// The verifier for each link the app asked auth for, kept until it returns.
const FLOWS_KEY = 'nhostLinkFlows';

/**
 * How many flows are kept. Every record stays well under 200 bytes, so the
 * list fits in one 2048-byte SecureStore value.
 */
export const MAX_FLOWS = 10;

/** How long a flow is kept, used or not. */
export const FLOW_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type FlowKind =
  | 'signIn'
  | 'emailVerify'
  | 'emailChange'
  | 'passwordReset';

export type Flow = {
  id: string;
  kind: FlowKind;
  createdAt: number;
  // Dropped once the flow is used.
  verifier?: string;
  // Set once a link for the flow has arrived. The record stays until it ages
  // out, so Android redelivering the link after process death, from recents
  // or an activity restore, finds it used instead of unknown.
  consumedAt?: number;
};

const isFlow = (value: unknown): value is Flow =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Flow).id === 'string' &&
  typeof (value as Flow).createdAt === 'number';

/** The flows still kept, oldest first. Anything unreadable counts as none. */
export function readFlows(now = Date.now()): Flow[] {
  const stored = getDeviceItem(FLOWS_KEY);
  if (!stored) {
    return [];
  }
  try {
    const flows: unknown = JSON.parse(stored);
    return Array.isArray(flows)
      ? flows.filter(
          (flow): flow is Flow =>
            isFlow(flow) && now - flow.createdAt < FLOW_MAX_AGE_MS,
        )
      : [];
  } catch {
    return [];
  }
}

function writeFlows(flows: Flow[]): void {
  setDeviceItem(FLOWS_KEY, JSON.stringify(flows));
}

// Used flows go first, the one used longest ago before the others; a flow
// still waiting for its link goes only when every record is one.
function makeRoom(flows: Flow[]): Flow[] {
  const kept = [...flows];
  while (kept.length >= MAX_FLOWS) {
    let evict = 0;
    for (const [index, flow] of kept.entries()) {
      const oldest = kept[evict]?.consumedAt;
      if (
        flow.consumedAt !== undefined &&
        (oldest === undefined || flow.consumedAt < oldest)
      ) {
        evict = index;
      }
    }
    kept.splice(evict, 1);
  }
  return kept;
}

export type StartedFlow = { codeChallenge: string; redirectTo: string };

/**
 * Starts a flow that ends in a link back to `destination`: the challenge for
 * auth, and the `redirectTo` that carries the flow's id.
 */
export async function startFlow(
  kind: FlowKind,
  destination: string,
): Promise<StartedFlow> {
  const { verifier, challenge } = await generatePKCEPair();
  const id = randomToken(16);
  writeFlows([
    ...makeRoom(readFlows()),
    { id, kind, verifier, createdAt: Date.now() },
  ]);
  return {
    codeChallenge: challenge,
    redirectTo: appUrl(destination, { [FLOW_PARAM]: id }),
  };
}

/** The flow `id` as it was, marking it used. */
function claimFlow(id: string): Flow | undefined {
  const flows = readFlows();
  const flow = flows.find((candidate) => candidate.id === id);
  if (flow && flow.consumedAt === undefined) {
    writeFlows(
      flows.map((candidate) =>
        candidate === flow
          ? {
              id: flow.id,
              kind: flow.kind,
              createdAt: flow.createdAt,
              consumedAt: Date.now(),
            }
          : candidate,
      ),
    );
  }
  return flow;
}

const isConsumed = (id: string): boolean =>
  readFlows().some((flow) => flow.id === id && flow.consumedAt !== undefined);

/** How long trading a code may hold the screen, the same bound as startup. */
export const LINK_TIMEOUT_MS = START_TIMEOUT_MS;

const discardListeners = new Set<VoidFunction>();

/**
 * Calls `listener` whenever a link arrives for a user already signed in. Its
 * code is not traded, but whatever it confirmed, such as an email change, has
 * happened, so the screen should load again.
 */
export function onLinkDiscarded(listener: VoidFunction): VoidFunction {
  discardListeners.add(listener);
  return () => {
    discardListeners.delete(listener);
  };
}

const isAuthLink = (link: IncomingLink): boolean =>
  [CODE_PARAM, ...ERROR_PARAMS].some((name) => param(link, name) !== undefined);

const linkKey = (link: IncomingLink, url: string): string => {
  const code = param(link, CODE_PARAM);
  if (code !== undefined) {
    return `code:${code}`;
  }
  const flow = param(link, FLOW_PARAM);
  return flow === undefined ? `url:${url}` : `flow:${flow}`;
};

const handled = new Map<string, Promise<string>>();

/**
 * Handles a link into the app once, however often it is delivered, and
 * resolves to the route to show, without `code`, `type`, `flow` or
 * `refreshToken`. A link with no code and no auth error resolves at once.
 * Never rejects.
 */
export function consumeLink(url: string): Promise<string> {
  const link = parseLink(url);
  if (!link) {
    return Promise.resolve('/');
  }
  if (!isAuthLink(link)) {
    return Promise.resolve(linkHref(without(link, LINK_PARAMS)));
  }

  const key = linkKey(link, url);
  let route = handled.get(key);
  if (!route) {
    route = handle(link);
    handled.set(key, route);
  }
  return route;
}

// The address may be verified even though the code could not sign anyone in:
// auth verifies it before redirecting.
function failed(link: IncomingLink, type?: string, flow?: Flow): string {
  const verified =
    type === 'verifyEmail' ||
    type === 'emailConfirmChange' ||
    flow?.kind === 'emailVerify';
  return linkHref({
    path: link.path,
    params: [
      ...without(link, ERROR_PARAMS).params,
      ['error', verified ? LINK_ERROR.emailVerified : LINK_ERROR.unusable],
    ],
  });
}

async function handle(link: IncomingLink): Promise<string> {
  const code = param(link, CODE_PARAM);
  const flowId = param(link, FLOW_PARAM);
  const type = param(link, LINK_TYPE_PARAM);
  const route = without(link, LINK_PARAMS);

  try {
    await startSession();

    const flow = flowId === undefined ? undefined : claimFlow(flowId);
    if (flow?.consumedAt !== undefined) {
      return linkHref(without(route, ERROR_PARAMS));
    }
    if (code === undefined) {
      return linkHref(route);
    }

    // A link may sign in a visitor who is signed out; it may not replace
    // somebody who is already here, whichever device asked for it. The code
    // expires unused.
    if (nhost.getUserSession()) {
      for (const listener of discardListeners) {
        listener();
      }
      return linkHref(route);
    }
    if (!flow?.verifier) {
      return failed(route, type, flow);
    }

    const session = await exchange(code, flow.verifier);
    if (!session) {
      return failed(route, type, flow);
    }

    // The marker first: whatever follows the session must never see it free
    // to go anywhere.
    if (type === PASSWORD_RESET_LINK_TYPE) {
      startPasswordReset(route.path);
    }
    nhost.sessionStorage.set(session);
    return linkHref(route);
  } catch (err) {
    console.error('Could not handle the link:', err);
    return linkHref(route);
  }
}

// On the bare client: the main one stores any session `/token/exchange`
// answers with, before the reset marker could be written.
async function exchange(
  code: string,
  codeVerifier: string,
): Promise<Session | undefined> {
  const request = bareAuth().tokenExchange({ code, codeVerifier });
  try {
    const answer = await bounded(request, LINK_TIMEOUT_MS);
    if (answer === TIMED_OUT) {
      console.error('Could not trade the link code in time');
      // Nothing stores a session that arrives now, so it is revoked.
      void request.then(
        ({ body }) => revoke(body.session?.refreshToken),
        () => undefined,
      );
      return undefined;
    }
    return answer.body.session;
  } catch (err) {
    console.error('Could not trade the link code:', err);
    return undefined;
  }
}

async function revoke(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }
  try {
    await bareAuth().signOut({ refreshToken });
  } catch (err) {
    console.error('Could not revoke the late link session:', err);
  }
}

let initial: Promise<void> | undefined;

/**
 * Settles once the link that opened the app, if any, has been handled: the
 * same `consumeLink` promise `+native-intent` waits on.
 */
export function settleInitialLink(): Promise<void> {
  initial ??= Linking.getInitialURL().then(
    async (url) => {
      if (url) {
        await consumeLink(url);
      }
    },
    (err: unknown) => {
      console.error('Could not read the link that opened the app:', err);
    },
  );
  return initial;
}

/**
 * `+native-intent`'s hook: every link the OS hands the app goes through
 * `consumeLink`. A link already handled stays where the app is (null) unless
 * it is the one opening the app, which needs a route to start on. One that
 * arrives while the app runs opens its route with nothing under it, as a link
 * opens a new tab on the web: Expo Router would push it over the sign-in
 * screens it was asked for from.
 */
export async function redirectSystemPath({
  path,
  initial: isInitial,
}: {
  path: string;
  initial: boolean;
}): Promise<string | null> {
  try {
    const link = parseLink(path);
    if (!link) {
      return '/';
    }
    if (!isInitial && isAuthLink(link)) {
      const flow = param(link, FLOW_PARAM);
      if (
        handled.has(linkKey(link, path)) ||
        (flow !== undefined && isConsumed(flow))
      ) {
        return null;
      }
      goTo(await consumeLink(path));
      return null;
    }
    return await consumeLink(path);
  } catch (err) {
    console.error('Could not open the link:', err);
    return '/';
  }
}
