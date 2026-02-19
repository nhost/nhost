# OpenID Conformance Suite

Runs the [OpenID Foundation Conformance Suite](https://gitlab.com/openid/conformance-suite) locally against Nhost Auth to validate the OAuth2/OIDC Identity Provider implementation.

## Test Plans

We run two test plans from the conformance suite. Together they validate the core Authorization Code flow, discovery metadata, JWKS, token handling, UserInfo, scopes, and client authentication methods.

### Plan 1: Basic Certification — Static Clients

```
oidcc-basic-certification-test-plan[server_metadata=discovery][client_registration=static_client]
```

The main certification plan. Uses three pre-registered OAuth2 clients (created by `setup.sh`) and validates the full Authorization Code flow.

**Test modules:**

| Module | What it validates |
|--------|-------------------|
| `oidcc-server` | Core Authorization Code flow end-to-end (auth request, code exchange, token validation, ID token claims, state round-trip, nonce in ID token) |
| `oidcc-response-type-missing` | Server rejects requests with missing `response_type` |
| `oidcc-id-token-signature` | ID token RS256 signature verification, `kid` header present |
| `oidcc-id-token-unsigned` | Server handles/rejects unsigned ID token requests |
| `oidcc-userinfo-get` | `GET /oauth2/userinfo` returns correct claims |
| `oidcc-userinfo-post-header` | `POST /oauth2/userinfo` with Bearer token in header |
| `oidcc-userinfo-post-body` | `POST /oauth2/userinfo` with token in body |
| `oidcc-ensure-request-without-nonce-succeeds-for-code-flow` | Code flow works without `nonce` parameter |
| `oidcc-scope-profile` | `profile` scope returns `name`, `picture`, `locale` |
| `oidcc-scope-email` | `email` scope returns `email`, `email_verified` |
| `oidcc-scope-address` | `address` scope handling (we don't support this — expect warning/skip) |
| `oidcc-scope-phone` | `phone` scope returns `phone_number`, `phone_number_verified` |
| `oidcc-scope-all` | All scopes requested together |
| `oidcc-ensure-other-scope-order-succeeds` | Scope ordering doesn't matter |
| `oidcc-display-page` | `display=page` parameter accepted |
| `oidcc-display-popup` | `display=popup` parameter accepted |
| `oidcc-prompt-login` | `prompt=login` parameter handling |
| `oidcc-prompt-none-not-logged-in` | `prompt=none` when not logged in |
| `oidcc-prompt-none-logged-in` | `prompt=none` when logged in |
| `oidcc-max-age-1` | `max_age=1` parameter handling |
| `oidcc-max-age-10000` | `max_age=10000` parameter handling |
| `oidcc-ensure-request-with-unknown-parameter-succeeds` | Unknown parameters don't cause errors |
| `oidcc-id-token-hint` | `id_token_hint` parameter handling |
| `oidcc-login-hint` | `login_hint` parameter handling |
| `oidcc-ui-locales` | `ui_locales` parameter accepted |
| `oidcc-claims-locales` | `claims_locales` parameter accepted |
| `oidcc-ensure-request-with-acr-values-succeeds` | `acr_values` parameter accepted |
| `oidcc-auth-code-reuse` | Authorization code rejected on second use |
| `oidcc-auth-code-reuse-after-30-seconds` | Authorization code rejected after 30s reuse attempt |
| `oidcc-ensure-registered-redirect-uri` | Unregistered redirect URI rejected |
| `oidcc-ensure-post-request-succeeds` | POST to authorization endpoint works |
| `oidcc-server-client-secret-post` | `client_secret_post` authentication at token endpoint |
| `oidcc-request-uri-unsigned-supported-correctly-or-rejected-as-unsupported` | Request URI handling (rejection is acceptable) |
| `oidcc-unsigned-request-object-supported-correctly-or-rejected-as-unsupported` | Request object handling (rejection is acceptable) |
| `oidcc-claims-essential` | `claims` parameter with essential claims |
| `oidcc-ensure-request-object-with-redirect-uri` | Request object redirect URI validation |
| `oidcc-refresh-token` | Refresh token grant (skipped if not supported) |
| `oidcc-ensure-request-with-valid-pkce-succeeds` | PKCE (S256) flow works |

**RFC coverage:**

| RFC | What's tested |
|-----|---------------|
| RFC 6749 | Authorization Code grant, error codes, redirect URI validation |
| RFC 6750 | Bearer token usage at UserInfo endpoint |
| RFC 7519 | JWT access tokens and ID tokens |
| RFC 7636 | PKCE with S256 |
| OIDC Core | ID token claims, UserInfo, scopes, nonce, auth_time |

### Plan 2: Config Certification — Discovery & Metadata

```
oidcc-config-certification-test-plan
```

This plan hardcodes its variants (`server_metadata=discovery`, `client_registration=static_client`) internally, so no variants are passed on the command line.

A focused validation of the OpenID Connect Discovery document and JWKS endpoint. Runs a single comprehensive test module:

| Module | What it validates |
|--------|-------------------|
| `oidcc-discovery-endpoint-verification` | Issuer matches, all required endpoints present (authorization, token, userinfo), JWKS URI accessible, valid JWK set, `openid` in `scopes_supported`, valid `response_types_supported`, `subject_types_supported`, `id_token_signing_alg_values_supported`, HTTPS on endpoints, `claims_parameter_supported` |

**RFC coverage:**

| RFC | What's tested |
|-----|---------------|
| RFC 8414 | OAuth 2.0 Authorization Server Metadata |
| RFC 7517 | JSON Web Key Set structure and content |
| OIDC Discovery | All required and recommended metadata fields |

## Test Plans NOT Run (and why)

| Plan | Reason |
|------|--------|
| `oidcc-dynamic-certification-test-plan` | Requires `private_key_jwt` client authentication, which we don't support |
| `oidcc-implicit-certification-test-plan` | Implicit flow not implemented (deprecated by OAuth 2.1) |
| `oidcc-hybrid-certification-test-plan` | Hybrid flow not implemented |
| `oidcc-formpost-*-certification-test-plan` | `response_mode=form_post` not implemented |
| `oidcc-session-management-certification-test-plan` | Session management not implemented |
| `oidcc-rp-initiated-logout-certification-test-plan` | RP-initiated logout not implemented |
| `oidcc-3rdparty-init-login-certification-test-plan` | 3rd-party initiated login not implemented |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│ Docker Compose Network                               │
│                                                      │
│  ┌─────────────┐     ┌──────┐     ┌────────────┐   │
│  │ Conformance │────>│ Auth │────>│Auto-consent│   │
│  │ Suite :8443 │     │ :4000│     │   :8080    │   │
│  └─────────────┘     └──┬───┘     └────────────┘   │
│         │            ┌───┼───┐                       │
│    ┌────┴───┐   ┌────┴┐ │  ┌┴──────┐               │
│    │MongoDB │   │Pg   │ │  │Hasura │               │
│    └────────┘   └─────┘ │  └───────┘               │
│                    ┌────┘                            │
│                    │Mailhog│                         │
│                    └───────┘                         │
└──────────────────────────────────────────────────────┘
```

All services communicate via Docker DNS. No `/etc/hosts` modifications needed.

The **auto-consent** service replaces the browser-based consent page. When the auth
service redirects to it with a `request_id`, it automatically signs in as the demo
user and approves the OAuth2 request, then redirects back with the authorization code.
This makes the entire authorization code flow work without a real browser.

## Prerequisites

- Docker and Docker Compose
- The `auth:0.0.0-dev` image built locally
- Git (to clone the conformance suite)
- Python 3 (for programmatic test execution)

Build the auth image from the repo root:

```bash
cd services/auth
make build-docker-image
```

## Quick Start

```bash
# Does everything: clone, build, start, setup
./run.sh

# Run all test plans
./run-tests.sh
```

`run.sh` will:
1. Clone the conformance suite repo (if not already present)
2. Build the Java JAR using Maven inside Docker (no local Maven needed)
3. Build and start all Docker services
4. Create the demo user and 3 OAuth2 clients via Hasura GraphQL
5. Write `test-config.json`

## Running Tests

### Option A: Run all plans programmatically

After `./run.sh` completes:

```bash
./run-tests.sh
```

This runs both test plans sequentially and reports pass/fail for each.

### Option B: Run a single plan programmatically

```bash
cd conformance-suite
python3 -m venv venv
. ./venv/bin/activate
pip install httpx pyparsing

# Basic Certification (static clients)
CONFORMANCE_SERVER=https://localhost.emobix.co.uk:8443 \
CONFORMANCE_DEV_MODE=1 \
DISABLE_SSL_VERIFY=1 \
python3 scripts/run-test-plan.py \
    'oidcc-basic-certification-test-plan[server_metadata=discovery][client_registration=static_client]' \
    ../test-config.json

# Config Certification (discovery & metadata)
# Note: this plan hardcodes its own variants, so none are passed on the command line.
CONFORMANCE_SERVER=https://localhost.emobix.co.uk:8443 \
CONFORMANCE_DEV_MODE=1 \
DISABLE_SSL_VERIFY=1 \
python3 scripts/run-test-plan.py \
    'oidcc-config-certification-test-plan' \
    ../test-config.json
```

### Option C: Using the Conformance Suite UI

1. Open **https://localhost.emobix.co.uk:8443** in your browser
   (`localhost.emobix.co.uk` resolves to `127.0.0.1` via public DNS and has a valid TLS cert)
2. Click **"Create a new test plan"**
3. Select the desired test plan (see [Test Plans](#test-plans) above)
4. Set **Server metadata** to `discovery`
5. Set **Client registration** to `static_client` or `dynamic_client`
6. Set **Test alias** to `nhost`
7. Paste the contents of `test-config.json`
8. Click **"Create test plan"** and run each test module

## How It Works

### Authorization Code Flow (automated)

1. Conformance suite constructs authorization URL: `http://auth:4000/oauth2/authorize?...`
2. Auth validates the request and redirects to `http://auto-consent:8080?request_id=<uuid>`
3. Auto-consent service:
   - Signs in as `demo@example.com` via `POST /signin/email-password`
   - Approves the request via `POST /oauth2/login` with the JWT
   - Returns `302` redirect to the conformance suite callback with `code` and `state`
4. Conformance suite receives the callback and validates tokens, claims, etc.

### Why auto-consent?

The standard OAuth2 authorization code flow requires a browser to render a consent
page where the user logs in. This creates two problems for CI:

1. You need a real browser (or Selenium/Playwright)
2. The browser and Docker containers must resolve the auth hostname identically
   (the classic `/etc/hosts` problem)

The auto-consent service solves both: it's a plain HTTP server that completes the
consent flow via API calls, keeping everything within Docker's network.

## Useful Links

| Service | URL |
|---------|-----|
| Conformance Suite | https://localhost.emobix.co.uk:8443 |
| Auth Service | http://localhost:4000 |
| OIDC Discovery | http://localhost:4000/.well-known/openid-configuration |
| JWKS | http://localhost:4000/oauth2/jwks |

## Interpreting Results

- **GREEN**: Test passed
- **YELLOW**: Warning (non-critical, review details)
- **RED**: Test failed (click for detailed request/response log)

Some test modules are designed to handle servers that don't support optional features.
For example, `oidcc-request-uri-unsigned-supported-correctly-or-rejected-as-unsupported`
passes whether the server supports request objects or correctly rejects them. Similarly,
`oidcc-scope-address` may produce a warning if the `address` scope isn't supported.

## Cleanup

```bash
docker compose down --volumes
```
