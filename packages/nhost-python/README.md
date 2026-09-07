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

Configuration is keyword-only, so adjacent URLs and credentials cannot be
accidentally transposed:

```python
from nhost import create_client

async with create_client(
    subdomain="my-project",
    region="eu-central-1",
) as nhost:
    response = await nhost.graphql.request("query { __typename }")
```

Omitting both `subdomain` and `region` uses the local Nhost endpoints. Supplying
only one is an error. Custom deployments can set individual service URLs:

```python
nhost = create_client(
    auth_url="http://localhost:1337/v1/auth",
    storage_url="http://localhost:1337/v1/storage",
    graphql_url="http://localhost:1337/v1/graphql",
    functions_url="http://localhost:1337/v1/functions",
)
```

`create_client` captures auth sessions, refreshes expiring access tokens, and
attaches the current token to requests. `create_nhost_client` creates a bare
client without session middleware. `create_server_client` requires an explicit
per-user asynchronous session backend.

Clients created by the SDK own and close their HTTP connection pools. An
injected `httpx.AsyncClient` remains owned by the caller.

## Auth and sessions

Generated methods mirror the Auth OpenAPI document. Request bodies and optional
parameters are keyword-only:

```python
import uuid
from nhost.auth import SignUpEmailPasswordRequest

response = await nhost.auth.sign_up_email_password(
    body=SignUpEmailPasswordRequest(
        email=f"ada-{uuid.uuid4()}@example.com",
        password=str(uuid.uuid4()),
    )
)
session = await nhost.get_user_session()
```

The high-level Auth facade adds stable conveniences such as
`nhost.auth.get_jwks()`, `generate_totp_secret()`, and
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

## Asynchronous session storage

Implement `SessionStorageBackend` with asynchronous `get`, `set`, and `remove`
methods. The default `MemoryStorage` is suitable for a single client. The
bundled `FileStorage` runs filesystem operations in worker threads, expands
`~`, writes atomically, and uses owner-only file permissions:

```python
from nhost import FileStorage, create_server_client

nhost = create_server_client(
    subdomain="my-project",
    region="eu-central-1",
    session_storage=FileStorage("~/.config/nhost/session.json"),
)
```

Storage failures and corrupt session files raise `SessionStorageError` rather
than silently signing the user out.

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
- Use a scoped session backend per user or request in server applications.
- Prefer an encrypted persistent backend for production credentials.
