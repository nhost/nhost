# Nhost Python SDK

Async-first Python SDK for Nhost Auth, Storage, GraphQL, Functions, and session
management.

- Python 3.11+
- Native `async`/`await`, powered by [`httpx`](https://www.python-httpx.org/)
- Typed request and response models powered by [Pydantic v2](https://docs.pydantic.dev/)
- PEP 561 type information (`py.typed`)

## Installation

Until the package is published, install it from a repository checkout:

```sh
uv pip install -e packages/nhost-python
# or: pip install -e packages/nhost-python
```

## Create a client

`Nhost` takes keyword arguments only, so adjacent URLs and credentials cannot be
accidentally transposed:

```python
from nhost import Nhost

async with Nhost(subdomain="my-project", region="eu-central-1") as nhost:
    response = await nhost.graphql.request("query { __typename }")
```

Omitting both `subdomain` and `region` uses the local Nhost endpoints. Supplying
only one is an error. Custom deployments can set individual service URLs:

```python
nhost = Nhost(
    auth_url="http://localhost:1337/v1/auth",
    storage_url="http://localhost:1337/v1/storage",
    graphql_url="http://localhost:1337/v1/graphql",
    functions_url="http://localhost:1337/v1/functions",
)
```

Other keywords: `middleware` runs your own HTTP middleware on every service
request before the SDK's, `timeout` sets the SDK's request timeout, and
`http_client` supplies your own `httpx.AsyncClient`, which stays owned by you;
otherwise the client owns and closes its connection pool.

## Sessions

A client manages sessions only when you give it somewhere to keep them. Without
a store, requests carry no user token, and sign-in responses are returned but
not kept.

### One user: `session_store`

A client acting for one user (a CLI, a script, a test) passes a `SessionStore`.
Sign-in and sign-up responses are stored, requests get the stored access token,
it is refreshed before it expires, and signing out clears it:

```python
import uuid
from nhost import MemoryStore, Nhost
from nhost.auth import SignUpEmailPasswordRequest

nhost = Nhost(subdomain="my-project", region="eu-central-1", session_store=MemoryStore())
await nhost.auth.sign_up_email_password(
    body=SignUpEmailPasswordRequest(
        email=f"ada-{uuid.uuid4()}@example.com",
        password=str(uuid.uuid4()),
    )
)
session = await nhost.get_session()
```

`MemoryStore` forgets the session when the process exits. `FileStore` keeps it
in a JSON file, so a CLI stays signed in between runs. It runs file operations
in worker threads, expands `~`, writes atomically, and makes the file readable
only by its owner:

```python
from nhost import FileStore

nhost = Nhost(session_store=FileStore("~/.config/my-cli/session.json"))
```

### Many users: `multi_user_session_store`

A server acting for many users passes a `MultiUserSessionStore`, keyed by user
ID, and says which user each request is for with `with_user_id`. The handle it
returns shares the client's connection pool and sessions:

```python
from nhost import MultiUserMemoryStore, Nhost

nhost = Nhost(multi_user_session_store=MultiUserMemoryStore())

# In a request handler, with a user ID your own authentication established:
user = nhost.with_user_id(user_id)
notes = await user.graphql.request("query { notes { id } }")
```

A request that names no user sends no token rather than someone else's, and
sessions are stored under the user the auth service returned them for. Take the
user ID from something you have verified, such as your own session cookie;
never from an access token a client sent, whose claims the SDK does not verify.

`MultiUserMemoryStore` keeps sessions for one process. Replicas that share
sessions implement `MultiUserSessionStore` over a shared store, with async
`load`, `save` and `delete` methods taking the user ID (a `SessionStore` has
the same methods without it):

```python
from redis.asyncio import Redis
from nhost import StoredSession

class RedisSessions:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def load(self, user_id: str) -> StoredSession | None:
        raw = await self.redis.get(f"nhost-session:{user_id}")
        return None if raw is None else StoredSession.model_validate_json(raw)

    async def save(self, user_id: str, session: StoredSession) -> None:
        await self.redis.set(f"nhost-session:{user_id}", session.model_dump_json(by_alias=True))

    async def delete(self, user_id: str) -> None:
        await self.redis.delete(f"nhost-session:{user_id}")
```

The auth service rotates the refresh token on every refresh. When a refresh is
rejected, the SDK deletes the session only if it still holds the rejected
token, because another replica may have refreshed first and stored a newer
one. It does that with the store's `delete_if_refresh_token(user_id,
refresh_token)` if it has one, which should delete and return `None` if the
stored session still holds `refresh_token` and otherwise return the stored
session, in one atomic step (a Redis script, a conditional `DELETE`). Without
it, the SDK loads, compares and deletes in separate calls. The built-in stores
all have it.

Concurrent refreshes of one session through one client collapse into one
request, which finishes even if every caller waiting for it is cancelled.
Different users refresh independently.

### A caller's own token: `with_access_token`

A server acting on behalf of a caller that sent its own access token uses
`with_access_token`. The token is sent as-is, and is never stored, refreshed or
replaced by a session from a response; the client's store is left alone. It
needs no store:

```python
nhost = Nhost(subdomain="my-project", region="eu-central-1")
caller = nhost.with_access_token(token_from_the_request)
notes = await caller.graphql.request("query { notes { id } }")
```

### Admin access: `admin`

```python
import os
from nhost import AdminSessionOptions, Nhost

admin = Nhost(admin=AdminSessionOptions(secret=os.environ["HASURA_ADMIN_SECRET"]))
```

The admin secret is sent to Storage, GraphQL and Functions. It cannot be
combined with a session store or `with_access_token`: the GraphQL engine lets
the admin secret override the user's token, so the user's permissions would be
silently skipped. Use a separate client for each, or act as a user with the
admin secret by setting `role` and `session_variables` in `AdminSessionOptions`.

### Failures

A store that raises fails the request with `SessionStoreError`, whose `error`
is the store's own exception: a sign-in whose session could not be saved, a
sign-out whose session could not be deleted, and a request whose session could
not be read all raise rather than appearing to succeed or going out without a
token. `get_session`, `refresh_session` and `clear_session` raise
`NoSessionStoreError` on a client without a store.

`nhost.session_manager` is the `SessionManager` a client and its handles share,
for storing a session obtained elsewhere or reading another user's session.

## Auth

Generated methods mirror the Auth OpenAPI document. Request bodies and optional
parameters are keyword-only. The high-level Auth facade adds stable
conveniences such as `nhost.auth.get_jwks()`, `generate_totp_secret()`, and
`get_oauth_authorization_server()` without renaming generated operations.

## GraphQL

GraphQL data can remain untyped or be validated into a Pydantic model:

```python
from pydantic import BaseModel

class Viewer(BaseModel):
    id: str

class QueryData(BaseModel):
    viewer: Viewer

response = await nhost.graphql.request(
    "query Viewer { viewer { id } }",
    response_type=QueryData,
    operation_name="Viewer",
)
print(response.body.data.viewer.id)
```

GraphQL execution errors raise `GraphQLExecutionError`. HTTP 4xx/5xx responses
raise `HTTPError`, and malformed successful responses raise
`ResponseDecodeError`. All response-related exceptions retain the original
`httpx.Response` and request.

## Storage

The high-level facade avoids wire-shaped multipart field names:

```python
from nhost import UploadFile
from nhost.storage import UploadFileMetadata

response = await nhost.storage.upload(
    [UploadFile(filename="hello.txt", content=b"hello from python")],
    bucket_id="default",
    metadata=[UploadFileMetadata(name="hello.txt")],
)
file_id = response.body.processed_files[0].id
content = await nhost.storage.get_file(file_id)
```

The generated `upload_files(body=...)` method remains available when exact
OpenAPI-level control is needed.

## Functions

```python
hello = await nhost.functions.post("/helloworld", json={"name": "Ada"})
print(hello.body)
```

Responses with `application/json` or a structured `+json` media type are parsed
as JSON; `text/*` becomes `str`; other content remains `bytes`. Passing
`json=None` explicitly sends JSON `null`.

## Generated API

`src/nhost/auth/client.py` and `src/nhost/storage/client.py` are generated from
the service OpenAPI documents. Their identifiers remain direct, deterministic
mappings from the specifications. Idiomatic convenience naming belongs in the
hand-written facade modules, not in generated output.

Generator source and tests are maintained in the `nhost-python-codegen` branch;
the SDK branch contains the regenerated output. Do not edit generated files by
hand.

## Development

```sh
make test-local         # offline unit tests and doctests (backend examples skip)
make dev-env-up         # start the local Nhost backend
make integration-local  # all doctests, including backend-dependent examples
```

## Security

- Never ship an admin secret in untrusted client-side code.
- Do not log access or refresh tokens.
- In a server, keep sessions in a `MultiUserSessionStore` and select the user
  with `with_user_id`, or send the caller's token with `with_access_token`;
  never share a `SessionStore` between users.
- Prefer an encrypted persistent store for production credentials.
